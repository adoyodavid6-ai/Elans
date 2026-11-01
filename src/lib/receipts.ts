import "server-only";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { randomToken } from "@/lib/security";
import { audit } from "@/lib/audit";
import { deliverSoon, queueMessage } from "@/lib/outbox";
import { ensureDefaultTemplates, nextNumber } from "@/lib/documents/store";
import { defaultData } from "@/lib/documents/defaults";
import { computeTotals, formatAmount } from "@/lib/documents/compute";
import { emptyClient, type DocTemplateConfig } from "@/lib/documents/types";

/**
 * Automatic receipts. Called only after a payment has been confirmed by its provider (a signed M-Pesa callback
 * whose CheckoutRequestID and amount match, a C2B confirmation matched to an invoice, or a Paystack transaction
 * verified with Paystack's API for the exact amount and currency). Issues one numbered receipt from the default
 * receipt template and emails the client a link straight away. Safe to call more than once per payment.
 */
type Info = {
  payment_id: string; tenant_id: string; tenant_name: string; status: string; provider: string; channel: string | null; purpose: string; reference: string;
  amount: string; currency: string; provider_ref: string | null; pay_email: string | null; created_at: Date;
  booking_type: string | null; booking_starts: Date | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null; contact_org: string | null;
  invoice_number: string | null; invoice_lines: { description?: string }[] | null; owner_name: string | null; owner_email: string | null;
};
const SESSION: Record<string, string> = { strategy: "Strategy Session", discovery: "Discovery Call", support: "Support session", diagnostic: "Diagnostic" };
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const validEmail = (e: string | null | undefined) => (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null);

function method(i: Info) {
  if (i.provider === "mock") return "Test payment (no money moved)";
  if (i.provider === "mpesa" || i.provider === "mpesa_c2b") return "M-Pesa";
  if (i.provider === "paystack") return i.channel === "mobile_money" ? "M-Pesa (via Paystack)" : i.channel === "bank_transfer" || i.channel === "bank" ? "Bank transfer (via Paystack)" : "Card (via Paystack)";
  return i.provider;
}

export type ReceiptResult = { status: "issued" | "exists" | "skipped"; documentId?: string; number?: string; emailedTo?: string | null; reason?: string };

export async function issueReceiptForPayment(paymentId: string): Promise<ReceiptResult> {
  if (!/^[0-9a-f-]{36}$/.test(paymentId)) return { status: "skipped", reason: "bad id" };
  const [i] = await withDb({ system: true }, (tx) => tx<Info[]>`select * from payment_receipt_info(${paymentId})`);
  if (!i) return { status: "skipped", reason: "unknown payment" };
  if (i.status !== "succeeded") return { status: "skipped", reason: `payment ${i.status}` };

  const forClient = i.tenant_id !== INTERNAL_TENANT_ID;
  const email = validEmail(i.contact_email) ?? validEmail(i.pay_email) ?? validEmail(i.owner_email);
  const amount = Number(i.amount);
  const res = await withDb({ tenantId: INTERNAL_TENANT_ID, system: true }, async (tx) => {
    const [existing] = await tx<{ id: string; number: string }[]>`select id, number from issued_documents where kind = 'receipt' and source_ref = ${`payment:${paymentId}`}`;
    if (existing) return { status: "exists" as const, documentId: existing.id, number: existing.number };
    await ensureDefaultTemplates(tx, "system");
    const [t] = await tx<{ id: string; config: DocTemplateConfig }[]>`select id, config from doc_templates where kind = 'receipt' and not archived order by is_default desc, updated_at desc limit 1`;
    if (!t) return { status: "skipped" as const, reason: "no receipt template" };
    const cfg = { ...t.config, money: { ...t.config.money, currency: i.currency || t.config.money.currency } };

    const data = defaultData("receipt", cfg);
    const desc = i.booking_type
      ? `${SESSION[i.booking_type] ?? "Session"}${i.booking_starts ? ` on ${i.booking_starts.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })} (EAT)` : ""}`
      : i.invoice_number ? `Invoice ${i.invoice_number}${i.invoice_lines?.[0]?.description ? `: ${i.invoice_lines[0].description}` : ""}` : `Payment ${i.reference}`;
    data.lines = [{ description: desc, details: "", qty: 1, unitPrice: amount, discountPct: 0, vat: false }];
    data.amountReceived = amount;
    data.method = method(i);
    data.paymentRef = i.provider === "paystack" ? `Paystack ${i.payment_id.slice(0, 8)}` : i.provider_ref ?? "";
    data.forInvoice = i.invoice_number ? `invoice ${i.invoice_number}` : desc;
    data.reference = i.reference;
    data.notes = i.provider === "mock" ? "Test-mode payment: no money was moved. This receipt is for testing only." : "Thank you for your payment.";
    for (const s of data.signatories) { s.name = cfg.company.name; s.title = "issued electronically on payment confirmation"; }

    const client = { ...emptyClient(), name: i.contact_name ?? (forClient ? i.owner_name ?? "" : ""), organisation: i.contact_org ?? (forClient ? i.tenant_name : ""), email: email ?? "", phone: i.contact_phone ?? "" };
    const totals = computeTotals("receipt", data, cfg);
    const number = await nextNumber(tx, "receipt", cfg);
    const token = randomToken(24);
    const [row] = await tx<{ id: string }[]>`
      insert into issued_documents (tenant_id, kind, template_id, number, status, title, client, data, snapshot, totals, source_ref, public_token, issued_at, created_by)
      values (app_tenant(), 'receipt', ${t.id}, ${number}, 'issued', ${`${client.organisation || client.name || "Client"}: ${desc}`.slice(0, 200)}, ${tx.json(client)}, ${tx.json(data as never)}, ${tx.json(cfg as never)}, ${tx.json(totals as never)}, ${`payment:${paymentId}`}, ${token}, now(), 'system (automatic)')
      on conflict do nothing returning id`;
    if (!row) return { status: "exists" as const };
    if (email) {
      const link = `${siteUrl()}/d/${token}`;
      await queueMessage(tx, {
        channel: "email", to: email,
        subject: `Receipt ${number}: payment of ${formatAmount(amount, cfg.money.currency)} received`,
        body: `Hello ${client.name || "there"},\n\nThank you. We have received your payment of ${formatAmount(amount, cfg.money.currency)} by ${data.method}${data.paymentRef ? ` (reference ${data.paymentRef})` : ""} for ${desc}.\n\nYour receipt ${number} is ready to view or download:\n${link}\n\n${cfg.company.name}`,
        meta: { kind: "receipt.auto", documentId: row.id, paymentId },
      });
      await tx`update issued_documents set emailed_to = ${email}, emailed_at = now() where id = ${row.id}`;
    }
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorLabel: "automatic receipts", action: "document.receipt.issued", entity: "issued_document", entityId: row.id, meta: { number, paymentId, emailed: Boolean(email) } });
    return { status: "issued" as const, documentId: row.id, number, emailedTo: email };
  });
  if (res.status === "issued" && res.emailedTo) await deliverSoon();
  return res;
}

/** Never lets a receipt problem undo or delay a confirmed payment. */
export async function autoReceipt(paymentId: string) {
  try { return await issueReceiptForPayment(paymentId); } catch (e) { console.error("[receipts]", paymentId, (e as Error).message); return { status: "skipped" as const, reason: (e as Error).message }; }
}
