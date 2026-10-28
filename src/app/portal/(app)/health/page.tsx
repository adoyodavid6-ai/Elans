import Link from "next/link";
import { portal } from "@/lib/portal";
import { Badge, Kpi, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";
import { formatPct } from "@/lib/core/money";

export default async function Health() {
  const c = await portal();
  const d = await c.db(async (tx) => ({
    byInstance: await tx<{ id: string; name: string; kill_switch: boolean; status: string; total: number; ok: number; failed: number; blocked: number; waiting: number; cost: number; last: Date | null }[]>`
      select e.id, e.name, e.kill_switch, e.status,
        count(r.id)::int as total, count(r.id) filter (where r.status = 'succeeded')::int as ok, count(r.id) filter (where r.status = 'failed')::int as failed,
        count(r.id) filter (where r.status = 'blocked')::int as blocked, count(r.id) filter (where r.status in ('waiting_review','waiting_approval'))::int as waiting,
        coalesce(sum(r.cost), 0) as cost, max(r.started_at) as last
      from engine_instances e left join runs r on r.engine_instance_id = e.id and r.started_at > now() - interval '30 days' group by e.id order by e.created_at`,
    runs: await tx<{ id: string; name: string; trigger: string; status: string; error: string | null; started_at: Date }[]>`
      select r.id, e.name, r.trigger, r.status, r.error, r.started_at from runs r join engine_instances e on e.id = r.engine_instance_id order by r.started_at desc limit 30`,
    incidents: await tx<{ id: string; severity: string; title: string; detail: string | null; status: string; opened_at: Date }[]>`select id, severity, title, detail, status, opened_at from incidents order by status = 'resolved', opened_at desc limit 20`,
  }));
  const t = d.byInstance.reduce((a, r) => ({ total: a.total + r.total, ok: a.ok + r.ok, failed: a.failed + r.failed, waiting: a.waiting + r.waiting }), { total: 0, ok: 0, failed: 0, waiting: 0 });
  const openInc = d.incidents.filter((i) => i.status !== "resolved").length;
  return (
    <>
      <PageTitle title="Workflow Health" description="Every run is recorded step by step. This page shows success rates, what is waiting on people, failures and incidents over the last 30 days." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Runs (30 days)" value={t.total} />
        <Kpi label="Completed" value={t.total ? formatPct(t.ok / t.total) : "—"} tone="good" />
        <Kpi label="Waiting on a person" value={t.waiting} href="/portal/approvals" tone={t.waiting ? "warn" : undefined} />
        <Kpi label="Open incidents" value={openInc} tone={openInc ? "bad" : "good"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="By automation">
          <Table head={["Automation", "Runs", "Done", "Waiting", "Failed / blocked", "Last run"]}>
            {d.byInstance.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2"><Link href={`/portal/automations/${r.id}?tab=runs`} className="font-medium text-copper-ink hover:underline">{r.name}</Link>{r.kill_switch && <> <Badge tone="bad">killed</Badge></>}</td>
                <td className="px-3 py-2">{r.total}</td><td className="px-3 py-2">{r.ok}</td><td className="px-3 py-2">{r.waiting}</td>
                <td className="px-3 py-2">{r.failed + r.blocked > 0 ? <Badge tone="bad">{r.failed} / {r.blocked}</Badge> : "0"}</td>
                <td className="px-3 py-2 text-muted">{r.last ? relTime(r.last) : "—"}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Incidents">
          {d.incidents.length === 0 ? <p className="text-sm text-muted">No incidents recorded.</p> : (
            <ul className="space-y-2">{d.incidents.map((i) => <li key={i.id} className="rounded-xl border border-line p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{i.title}</span><span className="flex gap-1"><Badge tone={i.severity === "sev1" || i.severity === "sev2" ? "bad" : "warn"}>{i.severity}</Badge><Badge tone={i.status === "resolved" ? "good" : "warn"}>{i.status}</Badge></span></div>{i.detail && <p className="mt-1 text-xs text-muted">{i.detail}</p>}<p className="text-xs text-muted">opened {relTime(i.opened_at)}</p></li>)}</ul>
          )}
          <p className="mt-3 text-xs text-muted">Severity: sev1 critical (all work stopped), sev2 major, sev3 single automation degraded, sev4 minor. Your Elans engineer is notified of every incident.</p>
        </Panel>
      </div>
      <Panel title="Recent runs" className="mt-6">
        <Table head={["Run", "Automation", "Trigger", "Status", "Started"]}>
          {d.runs.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2"><Link href={`/portal/runs/${r.id}`} className="font-mono text-xs text-copper-ink hover:underline">{r.id.slice(0, 8)}</Link></td>
              <td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 text-xs">{r.trigger}</td>
              <td className="px-3 py-2"><Badge tone={r.status === "succeeded" ? "good" : r.status === "failed" || r.status === "blocked" ? "bad" : "warn"}>{r.status.replace("_", " ")}</Badge>{r.error && <p className="text-xs text-danger">{r.error}</p>}</td>
              <td className="px-3 py-2 text-muted">{relTime(r.started_at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
