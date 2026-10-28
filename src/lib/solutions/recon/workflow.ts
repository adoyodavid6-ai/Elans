import "server-only";
import type { Tx } from "@/lib/db";
import { execute, gate, meter, requireReview, resumeRun, settleRunIfDone, startRun, step, type EngineInstance, type RunCtx } from "@/lib/runtime/engine";
import { queueMessage } from "@/lib/outbox";
import { tokens } from "@/lib/core/scoring";
import { sha256 } from "@/lib/security";

/** M-Pesa & bank reconciliation: deterministic matching first, scored suggestions second, people for the rest. */
export interface ReconConfig {
  autoApplyThreshold: number; // e.g. 0.9
}
export interface StatementRow {
  txnRef: string;
  txnAt: string;
  amount: number;
  payerName?: string;
  payerPhone?: string;
  reference?: string;
}
interface Receivable {
  id: string;
  number: string;
  customer_name: string;
  customer_phone: string | null;
  account_ref: string | null;
  balance: number;
}

const norm = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const phoneKey = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-9);

export function matchCandidates(row: StatementRow, open: Receivable[]) {
  const ref = norm(row.reference);
  const refTokens = tokens(row.reference ?? "");
  const nameTokens = tokens(row.payerName ?? "");
  return open
    .map((r) => {
      const reasons: string[] = [];
      let c = 0;
      if (ref && (ref === norm(r.account_ref) || ref === norm(r.number))) {
        c = 1;
        reasons.push("account reference matches exactly");
      } else if (ref && r.account_ref && ref.includes(norm(r.account_ref))) {
        c = 0.93;
        reasons.push("reference contains the account number");
      }
      if (c < 0.95 && phoneKey(row.payerPhone) && phoneKey(row.payerPhone) === phoneKey(r.customer_phone)) {
        c = Math.max(c, Math.abs(row.amount - r.balance) < 1 ? 0.95 : 0.8);
        reasons.push("payer phone matches the customer");
      }
      const custTokens = tokens(r.customer_name);
      const overlap = [...custTokens].filter((t) => refTokens.has(t) || nameTokens.has(t)).length;
      if (overlap && c < 0.9) {
        c = Math.max(c, Math.min(0.85, 0.45 + 0.2 * overlap));
        reasons.push(`name words match (${overlap})`);
      }
      if (c > 0 && Math.abs(row.amount - r.balance) < 1) {
        c = Math.min(1, c + 0.05);
        reasons.push("amount equals the balance due");
      } else if (c > 0 && row.amount > r.balance + 1) {
        c = Math.max(0, c - 0.15);
        reasons.push("payment exceeds the balance (possible overpayment or wrong match)");
      }
      return { receivableId: r.id, number: r.number, customer: r.customer_name, balance: r.balance, confidence: Number(c.toFixed(2)), reasons };
    })
    .filter((x) => x.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export async function importStatement(tx: Tx, inst: EngineInstance, rows: StatementRow[], source: string) {
  const cfg = inst.config as unknown as ReconConfig;
  const key = `stmt:${sha256(JSON.stringify(rows.map((r) => r.txnRef))).slice(0, 32)}`;
  const { ctx, duplicate } = await startRun(tx, { tenantId: inst.tenant_id, instanceId: inst.id, trigger: `statement:${source}`, idempotencyKey: key, input: { rows: rows.length, source } });
  if (duplicate) return { runId: ctx.runId, duplicate: true };
  const summary = { imported: 0, skipped: 0, auto: 0, suggested: 0, unmatched: 0 };
  const res = await execute(ctx, async () => {
    for (const row of rows) {
      const inserted = await tx<{ id: string }[]>`insert into recon_transactions (tenant_id, engine_instance_id, source, txn_ref, txn_at, amount, payer_name, payer_phone, reference)
        values (${inst.tenant_id}, ${inst.id}, ${source}, ${row.txnRef}, ${new Date(row.txnAt)}, ${row.amount}, ${row.payerName ?? null}, ${row.payerPhone ?? null}, ${row.reference ?? null})
        on conflict (engine_instance_id, txn_ref) do nothing returning id`;
      if (!inserted.length) {
        summary.skipped++;
        continue;
      }
      summary.imported++;
      const txnId = inserted[0].id;
      const open = await tx<Receivable[]>`select id, number, customer_name, customer_phone, account_ref, balance from recon_receivables where engine_instance_id = ${inst.id} and status <> 'paid'`;
      const cands = await step(ctx, `Match ${row.txnRef}`, "rule", row, async () => {
        const c = matchCandidates(row, open);
        return { output: c, meta: { confidence: c[0]?.confidence ?? 0, model: "rules" } };
      });
      const best = cands[0];
      if (best && best.confidence >= cfg.autoApplyThreshold) {
        await applyMatch(ctx, inst, txnId, best.receivableId, "auto", best.confidence);
        summary.auto++;
      } else {
        await tx`update recon_transactions set status = ${best ? "suggested" : "unmatched"}, confidence = ${best?.confidence ?? null} where id = ${txnId}`;
        await requireReview(ctx, {
          kind: "recon.match",
          title: `${row.txnRef}: KES ${row.amount.toLocaleString("en-GB")} from ${row.payerName ?? row.payerPhone ?? "unknown"} ${row.reference ? `("${row.reference}")` : ""}`,
          payload: { txnId, row, candidates: cands },
          queue: "client",
          slaHours: 24,
        });
        if (best) summary.suggested++;
        else summary.unmatched++;
      }
      await meter(ctx, "txn_reconciled", 1);
    }
    return summary;
  });
  return { runId: ctx.runId, duplicate: false, summary, ok: res.ok };
}

async function applyMatch(ctx: RunCtx, inst: EngineInstance, txnId: string, receivableId: string, method: "auto" | "reviewer", confidence: number) {
  const tx = ctx.tx;
  const [t] = await tx<{ amount: number; txn_ref: string }[]>`select amount, txn_ref from recon_transactions where id = ${txnId}`;
  const [r] = await tx<{ balance: number; customer_name: string; customer_phone: string | null; number: string }[]>`
    update recon_receivables set balance = greatest(0, balance - ${t.amount}), status = case when balance - ${t.amount} <= 0.5 then 'paid' else 'part_paid' end
    where id = ${receivableId} returning balance, customer_name, customer_phone, number`;
  await tx`update recon_transactions set receivable_id = ${receivableId}, match_method = ${method}, confidence = ${confidence}, status = 'matched' where id = ${txnId}`;
  const message = `Thank you ${r.customer_name.split(" ")[0]}. We have received KES ${Number(t.amount).toLocaleString("en-GB")} (ref ${t.txn_ref}) for ${r.number}. Balance: KES ${Number(r.balance).toLocaleString("en-GB")}.`;
  const g = await gate(ctx, { actionType: "recon.send_receipt", title: `Send receipt to ${r.customer_name}`, summary: message, proposed: { txnId, to: r.customer_phone, message } });
  if (g === "auto") await sendReceipt(tx, txnId, r.customer_phone, message);
}

export async function sendReceipt(tx: Tx, txnId: string, to: string | null, message: string) {
  await queueMessage(tx, { channel: "whatsapp", to: to ?? "unknown", body: message, meta: { kind: "receipt", txnId } });
  await tx`update recon_transactions set receipted_at = now() where id = ${txnId}`;
}

export async function onMatchReviewed(tx: Tx, item: { run_id: string; payload: { txnId: string } }, d: { decision: "accept" | "correct" | "reject"; receivableId?: string }) {
  const [t] = await tx<{ engine_instance_id: string }[]>`select engine_instance_id from recon_transactions where id = ${item.payload.txnId}`;
  const [inst] = await tx<EngineInstance[]>`select * from engine_instances where id = ${t.engine_instance_id}`;
  const ctx = await resumeRun(tx, item.run_id);
  if (d.decision === "reject" || !d.receivableId) await tx`update recon_transactions set status = 'ignored', match_method = 'reviewer' where id = ${item.payload.txnId}`;
  else await applyMatch(ctx, inst, item.payload.txnId, d.receivableId, "reviewer", 1);
  await settleRunIfDone(tx, item.run_id);
}
