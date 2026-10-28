import Link from "next/link";
import { portal } from "@/lib/portal";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";
import { EmptyState } from "@/components/ui/primitives";

export default async function Automations() {
  const c = await portal();
  const rows = await c.db((tx) => tx<{ id: string; name: string; solution_slug: string; status: string; kill_switch: boolean; owner_metric: string; template_version: string; runs: number; last: Date | null; failed: number }[]>`
    select e.id, e.name, e.solution_slug, e.status, e.kill_switch, e.owner_metric, e.template_version,
      (select count(*)::int from runs r where r.engine_instance_id = e.id) as runs,
      (select max(started_at) from runs r where r.engine_instance_id = e.id) as last,
      (select count(*)::int from runs r where r.engine_instance_id = e.id and r.status = 'failed') as failed
    from engine_instances e order by e.created_at`);
  return (
    <>
      <PageTitle title="My Automations" description="Every automation, its owner metric, status and controls. Open one to see its run history, change autonomy or use the kill switch." />
      {rows.length === 0 ? <EmptyState icon="bolt" title="No automations yet">Your first automation appears here after kick-off.</EmptyState> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/portal/automations/${r.id}`}>
              <Panel className="h-full transition hover:shadow-[var(--shadow-soft)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-semibold text-heading">{r.name}</p>
                  <span className="flex gap-1">{r.kill_switch && <Badge tone="bad">kill switch on</Badge>}<Badge tone={r.status === "live" ? "good" : r.status === "paused" ? "warn" : "info"}>{r.status}</Badge></span>
                </div>
                <p className="mt-1 text-sm text-muted">Owner metric: {r.owner_metric}</p>
                <p className="mt-3 text-xs text-muted">{r.runs} runs · {r.failed} failed · last run {r.last ? relTime(r.last) : "never"} · template v{r.template_version}</p>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
