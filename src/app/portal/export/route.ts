import { NextResponse } from "next/server";
import { portal } from "@/lib/portal";
import { audit } from "@/lib/audit";

/** Data export (Kenya DPA right of access / portability): everything held for this tenant, as JSON. Files are listed, not embedded. */
export async function GET() {
  const c = await portal();
  const data = await c.db(async (tx) => {
    const t = async (name: string, q: PromiseLike<readonly unknown[]>) => [name, await q] as const;
    const parts = await Promise.all([
      t("engine_instances", tx`select id, solution_slug, name, status, autonomy, owner_metric, baseline_value, kill_switch, created_at from engine_instances`),
      t("conversations", tx`select id, channel, visitor_ref, status, resolution, created_at from conversations`),
      t("messages", tx`select conversation_id, direction, author, body, created_at from messages`),
      t("etims_invoices", tx`select supplier_pin, supplier_name, invoice_no, cu_invoice_no, invoice_date, amount_total, vat_amount, status, reason, created_at from etims_invoices`),
      t("etims_suppliers", tx`select pin, name, invoices_total, invoices_invalid, status from etims_suppliers`),
      t("recon_receivables", tx`select number, customer_name, customer_phone, account_ref, amount, balance, status from recon_receivables`),
      t("recon_transactions", tx`select txn_ref, txn_at, amount, payer_name, payer_phone, reference, status, match_method from recon_transactions`),
      t("approvals", tx`select action_type, title, status, decided_by, decided_at from approvals`),
      t("tickets", tx`select subject, priority, status, created_at from tickets`),
      t("documents", tx`select id, name, kind, size_bytes, created_at from documents`),
      t("invoices", tx`select number, status, amount, currency, issued_at, due_date, paid_at from invoices`),
      t("dpa_requests", tx`select subject_ref, type, status, received_at, due_at from dpa_requests`),
      t("audit_log", tx`select actor_label, action, entity, created_at from audit_log order by created_at desc limit 5000`),
    ]);
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: c.user.name, action: "data.exported" });
    return Object.fromEntries(parts);
  });
  const body = JSON.stringify({ tenant: c.tenantName, exportedAt: new Date().toISOString(), exportedBy: c.user.email, data }, null, 2);
  return new NextResponse(body, { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="elans-export-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "private, no-store" } });
}
