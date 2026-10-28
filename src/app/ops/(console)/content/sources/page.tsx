import { requireStaff } from "@/lib/auth";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { saveSource } from "@/app/ops/cms-actions";
import { PageTitle, Panel, Badge } from "@/components/app/AppShell";
import { Callout } from "@/components/ui/primitives";

export default async function Sources() {
  const u = await requireStaff();
  const rows = await withDb({ tenantId: INTERNAL_TENANT_ID, userId: u.id }, (tx) => tx<{ id: string; claim: string; url: string | null; source_type: string | null; accessed_on: Date | null; state: string; notes: string | null }[]>`select * from sources order by id`);
  return (
    <>
      <PageTitle title="Sources" description="The only permitted origin of statistics in public copy (zero-fabrication rule). Mark a source verified only after opening it and confirming the figure, wording and date." />
      <Callout tone="warning" className="mb-6">{rows.filter((r) => r.state === "unverified").length} of {rows.length} sources are unverified and must not be used in public copy.</Callout>
      <div className="space-y-3">
        {rows.map((r) => (
          <Panel key={r.id}>
            <form action={saveSource.bind(null, r.id)} className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-semibold">{r.id} · {r.claim}</p>
                <p className="mt-1 break-all text-xs text-muted">{r.url} · {r.source_type}</p>
                <input name="notes" defaultValue={r.notes ?? ""} aria-label="Notes" className="mt-2 h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs" />
              </div>
              <div className="flex items-start gap-2">
                <Badge tone={r.state === "verified" ? "good" : r.state === "vendor_estimate" ? "info" : "warn"}>{r.state}</Badge>
                <select name="state" defaultValue={r.state} aria-label="State" className="h-9 rounded-lg border border-line bg-surface px-2 text-xs"><option value="unverified">unverified</option><option value="verified">verified</option><option value="vendor_estimate">vendor estimate</option></select>
                <input type="date" name="accessed_on" defaultValue={r.accessed_on ? new Date(r.accessed_on).toISOString().slice(0, 10) : ""} aria-label="Accessed on" className="h-9 rounded-lg border border-line bg-surface px-2 text-xs" />
                <button className="h-9 rounded-lg bg-surface-2 px-3 text-xs font-semibold ring-1 ring-line">Save</button>
              </div>
            </form>
          </Panel>
        ))}
      </div>
    </>
  );
}
