import { requireStaff } from "@/lib/auth";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { activateWeights, saveWeights } from "@/app/ops/cms-actions";
import { CRITERIA, DEFAULT_WEIGHTS, type Weights } from "@/lib/core/scoring";
import { PageTitle, Panel, Badge, Table } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";

export default async function WeightsPage() {
  const u = await requireStaff();
  const versions = await withDb({ tenantId: INTERNAL_TENANT_ID, userId: u.id }, (tx) => tx<{ id: number; weights: Weights; note: string | null; active: boolean; created_at: Date; created_by: string | null }[]>`select * from score_weight_versions order by id desc`);
  const active = versions.find((v) => v.active)?.weights ?? DEFAULT_WEIGHTS;
  const admin = u.staffRole === "admin";
  return (
    <>
      <PageTitle title="Opportunity Score weights" description="Weights are versioned. Every assessment records the version it was scored with, so changing weights never rewrites past reports." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="New version">
          <form action={saveWeights} className="space-y-3">
            {CRITERIA.map((c) => (
              <label key={c.key} className="flex items-center justify-between gap-4 text-sm">
                <span>{c.label}</span>
                <input name={c.key} type="number" min={0} max={50} defaultValue={active[c.key]} disabled={!admin} className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-right" />
              </label>
            ))}
            <input name="note" placeholder="Why are you changing the weights?" disabled={!admin} aria-label="Change note" className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" />
            <p className="text-xs text-muted">Weights are normalised to 100, so they need not sum to exactly 100.</p>
            {admin && <button className="rounded-lg bg-brown px-5 py-2 text-sm font-semibold text-white">Save as new active version</button>}
          </form>
        </Panel>
        <Panel title="Versions">
          <Table head={["Version", "Note", "Created", "State"]}>
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="px-3 py-2">v{v.id}</td>
                <td className="px-3 py-2 text-xs">{v.note}</td>
                <td className="px-3 py-2 text-xs text-muted">{relTime(v.created_at)} · {v.created_by}</td>
                <td className="px-3 py-2">{v.active ? <Badge tone="good">active</Badge> : admin ? <form action={activateWeights.bind(null, v.id)}><button className="rounded-md bg-surface-2 px-2 py-1 text-xs ring-1 ring-line">Activate</button></form> : null}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
