import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { audit } from "@/lib/audit";
import { INTERNAL_TENANT_ID } from "@/lib/db";

/** CSV export of leads (respecting the current stage filter). Audited, because it contains personal data. */
export async function GET(req: Request) {
  const u = await requireStaff(["admin", "consultant"]);
  const stage = new URL(req.url).searchParams.get("stage");
  const rows = await asStaff(u, async (tx) => {
    const r = await tx<Record<string, unknown>[]>`
      select c.name, c.email, c.phone, c.organisation, l.source, l.source_detail, l.industry, l.score, l.stage, l.next_action, l.next_action_due,
        (select granted from consents k where k.contact_id = c.id and k.purpose = 'marketing' order by k.created_at desc limit 1) as marketing_consent,
        l.created_at
      from leads l left join contacts c on c.id = l.contact_id
      where (${stage}::text is null or l.stage = ${stage}) and c.erased_at is null order by l.created_at desc`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "leads.exported", meta: { stage, rows: r.length } });
    return r;
  });
  const cols = ["name", "email", "phone", "organisation", "source", "source_detail", "industry", "score", "stage", "next_action", "next_action_due", "marketing_consent", "created_at"];
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : String(v);
    // Quote everything; neutralise spreadsheet formula injection.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
  return new Response("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="elans-leads-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "private, no-store" } });
}
