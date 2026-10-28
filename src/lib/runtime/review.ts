import "server-only";
import type { Tx } from "@/lib/db";
import { onExtractionReviewed } from "@/lib/solutions/etims/workflow";
import { onMatchReviewed } from "@/lib/solutions/recon/workflow";
import { sendSupplierRequest } from "@/lib/solutions/etims/workflow";
import { sendReceipt } from "@/lib/solutions/recon/workflow";
import { settleRunIfDone } from "./engine";

/** Applies a human review decision and continues the workflow that was waiting on it. */
export async function applyReviewDecision(tx: Tx, itemId: string, d: { decision: "accept" | "correct" | "reject"; correction?: string; by: string }) {
  const [item] = await tx<{ id: string; kind: string; status: string; run_id: string; payload: Record<string, unknown> }[]>`select id, kind, status, run_id, payload from review_items where id = ${itemId} for update`;
  if (!item || item.status !== "open") return { ok: false, message: "Already decided" };
  let parsed: Record<string, unknown> = {};
  if (d.correction) {
    try {
      parsed = JSON.parse(d.correction);
    } catch {
      return { ok: false, message: "Correction is not valid JSON" };
    }
  }
  await tx`update review_items set status = 'resolved', decided_by = ${d.by}, decided_at = now(), decision = ${tx.json({ decision: d.decision, ...parsed } as never)} where id = ${itemId}`;
  if (item.kind === "etims.extraction") {
    await onExtractionReviewed(tx, item as never, { decision: d.decision, corrected: parsed as never });
  } else if (item.kind === "recon.match") {
    await onMatchReviewed(tx, item as never, { decision: d.decision, receivableId: parsed.receivableId as string | undefined });
  } else {
    await settleRunIfDone(tx, item.run_id);
  }
  return { ok: true, message: "Decision applied" };
}

/** Approves or rejects a gated action and, if approved, performs it. */
export async function applyApprovalDecision(tx: Tx, approvalId: string, d: { approve: boolean; by: string; editedMessage?: string }) {
  const [a] = await tx<{ id: string; action_type: string; status: string; run_id: string; engine_instance_id: string; tenant_id: string; proposed: Record<string, unknown> }[]>`select * from approvals where id = ${approvalId} for update`;
  if (!a || a.status !== "pending") return { ok: false, message: "Already decided" };
  const proposed = d.editedMessage ? { ...a.proposed, message: d.editedMessage } : a.proposed;
  await tx`update approvals set status = ${d.approve ? "approved" : "rejected"}, decided_by = ${d.by}, decided_at = now(), proposed = ${tx.json(proposed as never)} where id = ${approvalId}`;
  if (d.approve) {
    if (a.action_type === "etims.supplier_request") await sendSupplierRequest(tx, a.tenant_id, a.engine_instance_id, proposed as never);
    if (a.action_type === "recon.send_receipt") await sendReceipt(tx, proposed.txnId as string, (proposed.to as string) ?? null, proposed.message as string);
  }
  if (a.run_id) await settleRunIfDone(tx, a.run_id);
  return { ok: true, message: d.approve ? "Approved and sent" : "Rejected" };
}
