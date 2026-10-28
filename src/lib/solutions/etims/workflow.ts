import "server-only";
import type { Tx } from "@/lib/db";
import { generateStructured } from "@/lib/ai";
import { execute, gate, meter, requireReview, resumeRun, settleRunIfDone, startRun, step, type EngineInstance, type RunCtx } from "@/lib/runtime/engine";
import { queueMessage } from "@/lib/outbox";
import { sha256 } from "@/lib/security";
import { etimsAdaptor } from "./etims-mock";
import { extractFromText, extractionSchema, FIELDS, validate, type Confidence, type Extracted } from "./extract";

/**
 * PROOF SOLUTION (Stage 10): eTIMS Compliance & Reconciliation.
 * intake → extraction (confidence per field) → validation rules → human review if uncertain
 * → eTIMS check (MOCK until the route is confirmed) → supplier register → approval-gated
 * supplier correction request → variance report. Owner metric: % of claimed expenses with valid
 * eTIMS support, and KES at risk.
 */

export interface EtimsConfig {
  buyerPin: string;
  period: string; // YYYY-MM
  threshold: number; // minimum per-field confidence for straight-through processing
}

export const PROMPT = { key: "etims.extract", version: "1.0.0" };

export interface IntakeInput {
  source: "upload" | "whatsapp" | "email" | "csv";
  filename: string;
  text?: string;
  image?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string };
  pdf?: string;
  documentId?: string;
}

async function extract(input: IntakeInput, threshold: number): Promise<{ fields: Extracted; confidence: Confidence; model: string; promptVersion: string; cost: number }> {
  if (input.text) {
    const r = extractFromText(input.text);
    return { ...r, model: "rules", promptVersion: "rules-1", cost: 0 };
  }
  const ai = await generateStructured({
    promptKey: PROMPT.key,
    promptVersion: PROMPT.version,
    budgetScope: "tenant",
    model: "primary",
    effort: "medium",
    maxTokens: 2000,
    instructions:
      "You extract fields from Kenyan supplier tax invoices for an eTIMS compliance check. Return null for any field that is not clearly printed; never guess a PIN, number or amount. Give honest per-field confidence between 0 and 1.",
    task: `Extract the invoice fields. Fields with confidence below ${threshold} will be checked by a person.`,
    images: input.image ? [input.image] : undefined,
    pdf: input.pdf,
    schema: extractionSchema,
  });
  if (!ai.ok) {
    // No model available or it declined: send every field to human review rather than guessing.
    const empty = Object.fromEntries(FIELDS.map((f) => [f, null])) as unknown as Extracted;
    const zero = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Confidence;
    return { fields: empty, confidence: zero, model: `unavailable:${ai.reason}`, promptVersion: PROMPT.version, cost: 0 };
  }
  const { confidence, ...fields } = ai.data;
  return { fields: { ...fields, supplierPin: fields.supplierPin?.toUpperCase() ?? null, buyerPin: fields.buyerPin?.toUpperCase() ?? null }, confidence, model: ai.meta.model, promptVersion: `${PROMPT.key}@${PROMPT.version}`, cost: ai.meta.costUsd };
}

export async function processInvoice(tx: Tx, inst: EngineInstance, input: IntakeInput) {
  const cfg = inst.config as unknown as EtimsConfig;
  const key = `doc:${sha256(input.text ?? input.image?.data ?? input.pdf ?? input.filename).slice(0, 32)}`;
  const { ctx, duplicate } = await startRun(tx, { tenantId: inst.tenant_id, instanceId: inst.id, trigger: `intake:${input.source}`, idempotencyKey: key, input: { filename: input.filename, source: input.source } });
  if (duplicate) return { runId: ctx.runId, duplicate: true, status: "duplicate_event" as const };

  let finalStatus = "pending_check";
  const result = await execute(ctx, async () => {
    const ex = await step(ctx, "Extract invoice fields", "ai", { filename: input.filename }, async () => {
      const r = await extract(input, cfg.threshold);
      const minConf = Math.min(...FIELDS.filter((f) => f !== "vatAmount").map((f) => r.confidence[f]));
      return { output: r, meta: { confidence: Number.isFinite(minConf) ? minConf : 0, model: r.model, promptVersion: r.promptVersion, cost: r.cost } };
    });
    await meter(ctx, "doc_page", 1, ex.cost);

    const flags = await step(ctx, "Validate fields (rules)", "rule", ex.fields, async () => ({ output: validate(ex.fields, cfg) }));

    const dup = await step(ctx, "Duplicate check", "rule", { pin: ex.fields.supplierPin, no: ex.fields.invoiceNo }, async () => {
      if (!ex.fields.supplierPin || !ex.fields.invoiceNo) return { output: false };
      const [d] = await tx`select id from etims_invoices where engine_instance_id = ${inst.id} and supplier_pin = ${ex.fields.supplierPin} and invoice_no = ${ex.fields.invoiceNo} and status <> 'duplicate' limit 1`;
      return { output: Boolean(d) };
    });

    // A missing CU number is handled as its own reason below, not as a low-confidence field.
    const lowFields = FIELDS.filter((f) => f !== "vatAmount" && f !== "cuInvoiceNo" && ex.confidence[f] < cfg.threshold);
    const wrongBuyer = flags.some((f) => f.startsWith("Issued to buyer PIN"));
    const missingCu = !ex.fields.cuInvoiceNo;
    const status = dup ? "duplicate" : wrongBuyer ? "invalid" : lowFields.length || missingCu || !ex.fields.supplierPin ? "needs_review" : "pending_check";

    const [row] = await tx<{ id: string }[]>`insert into etims_invoices (tenant_id, engine_instance_id, run_id, document_id, source, period, supplier_pin, supplier_name, buyer_pin, invoice_no, cu_invoice_no, invoice_date, amount_total, vat_amount, field_confidence, status, reason)
      values (${inst.tenant_id}, ${inst.id}, ${ctx.runId}, ${input.documentId ?? null}, ${input.source}, ${cfg.period}, ${ex.fields.supplierPin}, ${ex.fields.supplierName}, ${ex.fields.buyerPin}, ${ex.fields.invoiceNo}, ${ex.fields.cuInvoiceNo},
        ${ex.fields.invoiceDate}, ${ex.fields.amountTotal}, ${ex.fields.vatAmount}, ${tx.json(ex.confidence)}, ${status}, ${dup ? "Same supplier PIN and invoice number already processed" : flags.join("; ") || null}) returning id`;

    if (status === "duplicate") {
      finalStatus = "duplicate";
      return { invoiceId: row.id, status };
    }
    if (status === "invalid") {
      await updateSupplier(tx, inst, ex.fields, false);
      await proposeSupplierRequest(ctx, inst, row.id, ex.fields, flags.join("; "));
      finalStatus = "invalid";
      return { invoiceId: row.id, status };
    }
    if (status === "needs_review") {
      await requireReview(ctx, {
        kind: "etims.extraction",
        title: `Check invoice ${ex.fields.invoiceNo ?? input.filename} from ${ex.fields.supplierName ?? "unknown supplier"}`,
        payload: { invoiceId: row.id, fields: ex.fields, confidence: ex.confidence, lowFields, flags, text: input.text?.slice(0, 4000) ?? null, filename: input.filename },
        queue: "elans",
        slaHours: 8,
      });
      finalStatus = "needs_review";
      return { invoiceId: row.id, status, lowFields };
    }
    const check = await checkAndRecord(ctx, inst, row.id, ex.fields);
    finalStatus = check;
    return { invoiceId: row.id, status: check };
  });
  return { runId: ctx.runId, duplicate: false, status: finalStatus, result };
}

async function checkAndRecord(ctx: RunCtx, inst: EngineInstance, invoiceId: string, f: Extracted): Promise<string> {
  const adaptor = etimsAdaptor();
  const check = await step(ctx, `eTIMS check (${adaptor.mode.toUpperCase()})`, "action", { cu: f.cuInvoiceNo }, async () => ({
    output: await adaptor.check({ cuInvoiceNo: f.cuInvoiceNo!, supplierPin: f.supplierPin, buyerPin: f.buyerPin, amountTotal: f.amountTotal }),
  }));
  await ctx.tx`update etims_invoices set status = ${check.status}, reason = ${check.reason}, check_ref = ${check.reference} where id = ${invoiceId}`;
  await meter(ctx, "etims_check", 1);
  await step(ctx, "Update supplier register", "rule", { pin: f.supplierPin }, async () => ({ output: await updateSupplier(ctx.tx, inst, f, check.status === "valid") }));
  if (check.status !== "valid") await proposeSupplierRequest(ctx, inst, invoiceId, f, check.reason);
  return check.status;
}

async function updateSupplier(tx: Tx, inst: EngineInstance, f: Extracted, ok: boolean) {
  if (!f.supplierPin) return null;
  const [s] = await tx<{ invoices_total: number; invoices_invalid: number }[]>`
    insert into etims_suppliers (tenant_id, engine_instance_id, pin, name, invoices_total, invoices_invalid)
    values (${inst.tenant_id}, ${inst.id}, ${f.supplierPin}, ${f.supplierName}, 1, ${ok ? 0 : 1})
    on conflict (engine_instance_id, pin) do update set invoices_total = etims_suppliers.invoices_total + 1, invoices_invalid = etims_suppliers.invoices_invalid + ${ok ? 0 : 1}, name = coalesce(etims_suppliers.name, excluded.name)
    returning invoices_total, invoices_invalid`;
  const rate = s.invoices_invalid / Math.max(1, s.invoices_total);
  const status = s.invoices_invalid === 0 ? "ok" : rate >= 0.5 && s.invoices_invalid >= 2 ? "non_compliant" : "watch";
  await tx`update etims_suppliers set status = ${status} where engine_instance_id = ${inst.id} and pin = ${f.supplierPin}`;
  return { status, ...s };
}

async function proposeSupplierRequest(ctx: RunCtx, inst: EngineInstance, invoiceId: string, f: Extracted, reason: string) {
  const message = `Hello ${f.supplierName ?? "supplier"}, this is Demo Hardware & Supplies Ltd. Your invoice ${f.invoiceNo ?? ""} dated ${f.invoiceDate ?? ""} for KES ${f.amountTotal?.toLocaleString("en-GB") ?? ""} could not be validated in eTIMS (${reason}). Please issue a valid eTIMS invoice to our PIN ${(inst.config as unknown as EtimsConfig).buyerPin}. Thank you.`;
  const decision = await gate(ctx, { actionType: "etims.supplier_request", title: `Ask ${f.supplierName ?? f.supplierPin ?? "supplier"} for a valid eTIMS invoice`, summary: reason, proposed: { invoiceId, supplierPin: f.supplierPin, supplierName: f.supplierName, channel: "whatsapp", message } });
  if (decision === "auto") await sendSupplierRequest(ctx.tx, inst.tenant_id, inst.id, { supplierPin: f.supplierPin, supplierName: f.supplierName, message });
}

export async function sendSupplierRequest(tx: Tx, tenantId: string, instanceId: string, p: { supplierPin: string | null; supplierName: string | null; message: string }) {
  await queueMessage(tx, { channel: "whatsapp", to: `supplier:${p.supplierPin ?? "unknown"}`, body: p.message, meta: { tenantId, kind: "etims.supplier_request" } });
  if (p.supplierPin) await tx`update etims_suppliers set last_request_at = now() where engine_instance_id = ${instanceId} and pin = ${p.supplierPin}`;
}

/** Called when a reviewer confirms or corrects extracted fields. Continues the run from the eTIMS check. */
export async function onExtractionReviewed(tx: Tx, item: { run_id: string; payload: { invoiceId: string; fields: Extracted } }, decision: { decision: "accept" | "correct" | "reject"; corrected?: Partial<Extracted> }) {
  const [row] = await tx<{ engine_instance_id: string }[]>`select engine_instance_id from etims_invoices where id = ${item.payload.invoiceId}`;
  if (!row) return;
  const [inst] = await tx<EngineInstance[]>`select * from engine_instances where id = ${row.engine_instance_id}`;
  const ctx = await resumeRun(tx, item.run_id);
  if (decision.decision === "reject") {
    await tx`update etims_invoices set status = 'invalid', reason = 'Rejected by reviewer: not a valid tax invoice' where id = ${item.payload.invoiceId}`;
    await settleRunIfDone(tx, item.run_id);
    return;
  }
  const f: Extracted = { ...item.payload.fields, ...(decision.corrected ?? {}) };
  const confirmed = Object.fromEntries(FIELDS.map((k) => [k, 1])) as Confidence;
  await tx`update etims_invoices set supplier_pin = ${f.supplierPin}, supplier_name = ${f.supplierName}, buyer_pin = ${f.buyerPin}, invoice_no = ${f.invoiceNo}, cu_invoice_no = ${f.cuInvoiceNo},
    invoice_date = ${f.invoiceDate}, amount_total = ${f.amountTotal}, vat_amount = ${f.vatAmount}, field_confidence = ${tx.json(confirmed)}, status = 'pending_check' where id = ${item.payload.invoiceId}`;
  if (!f.cuInvoiceNo) {
    await tx`update etims_invoices set status = 'not_found', reason = 'No CU invoice number: not issued through eTIMS' where id = ${item.payload.invoiceId}`;
    await updateSupplier(tx, inst, f, false);
    await proposeSupplierRequest(ctx, inst, item.payload.invoiceId, f, "No CU invoice number printed");
  } else {
    await checkAndRecord(ctx, inst, item.payload.invoiceId, f);
  }
  await settleRunIfDone(tx, item.run_id);
}

export interface VarianceReport {
  period: string;
  invoices: number;
  claimed: number;
  validAmount: number;
  atRisk: number;
  pctSupported: number;
  byStatus: { status: string; count: number; amount: number }[];
  suppliers: { pin: string; name: string | null; invoices: number; invalid: number; status: string; atRisk: number }[];
  ledger?: { inLedgerNotCaptured: { supplierPin: string; invoiceNo: string; amount: number }[]; capturedNotInLedger: { supplierPin: string | null; invoiceNo: string | null; amount: number | null }[] };
}

export async function varianceReport(tx: Tx, instanceId: string, period: string, ledger?: { supplierPin: string; invoiceNo: string; amount: number }[]): Promise<VarianceReport> {
  const rows = await tx<{ status: string; supplier_pin: string | null; supplier_name: string | null; invoice_no: string | null; amount_total: number | null }[]>`
    select status, supplier_pin, supplier_name, invoice_no, amount_total from etims_invoices where engine_instance_id = ${instanceId} and period = ${period} and status <> 'duplicate'`;
  const amt = (r: { amount_total: number | null }) => Number(r.amount_total ?? 0);
  const claimed = rows.reduce((s, r) => s + amt(r), 0);
  const validAmount = rows.filter((r) => r.status === "valid").reduce((s, r) => s + amt(r), 0);
  const statuses = [...new Set(rows.map((r) => r.status))];
  const suppliers = await tx<{ pin: string; name: string | null; invoices_total: number; invoices_invalid: number; status: string }[]>`select pin, name, invoices_total, invoices_invalid, status from etims_suppliers where engine_instance_id = ${instanceId} order by invoices_invalid desc, invoices_total desc`;
  const report: VarianceReport = {
    period,
    invoices: rows.length,
    claimed,
    validAmount,
    atRisk: claimed - validAmount,
    pctSupported: claimed > 0 ? validAmount / claimed : 0,
    byStatus: statuses.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length, amount: rows.filter((r) => r.status === s).reduce((a, r) => a + amt(r), 0) })).sort((a, b) => b.amount - a.amount),
    suppliers: suppliers.map((s) => ({ pin: s.pin, name: s.name, invoices: s.invoices_total, invalid: s.invoices_invalid, status: s.status, atRisk: rows.filter((r) => r.supplier_pin === s.pin && r.status !== "valid").reduce((a, r) => a + amt(r), 0) })),
  };
  if (ledger) {
    const key = (p: string | null, n: string | null) => `${p ?? ""}|${(n ?? "").toUpperCase()}`;
    const captured = new Set(rows.map((r) => key(r.supplier_pin, r.invoice_no)));
    const led = new Set(ledger.map((l) => key(l.supplierPin, l.invoiceNo)));
    report.ledger = {
      inLedgerNotCaptured: ledger.filter((l) => !captured.has(key(l.supplierPin, l.invoiceNo))),
      capturedNotInLedger: rows.filter((r) => !led.has(key(r.supplier_pin, r.invoice_no))).map((r) => ({ supplierPin: r.supplier_pin, invoiceNo: r.invoice_no, amount: r.amount_total })),
    };
  }
  return report;
}
