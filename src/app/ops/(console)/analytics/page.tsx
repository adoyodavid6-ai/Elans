import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { formatMoney } from "@/lib/core/money";
import { Kpi, PageTitle, Panel, Table } from "@/components/app/AppShell";

export default async function Analytics() {
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => ({
    bySource: await tx<{ source: string; leads: number; won: number }[]>`select l.source, count(*)::int as leads, count(*) filter (where l.stage = 'won')::int as won from leads l group by l.source order by leads desc`,
    funnel: await tx<{ stage: string; n: number }[]>`select stage, count(*)::int as n from leads group by stage`,
    assess: await tx<{ started: number; submitted: number }[]>`select count(*)::int as started, count(*) filter (where state <> 'draft')::int as submitted from assessments`,
    chat: await tx<{ total: number; handed: number; resolved: number }[]>`select count(*)::int as total, count(*) filter (where resolution = 'handed_off' or status = 'handed_off')::int as handed, count(*) filter (where resolution = 'resolved')::int as resolved from conversations where channel = 'web'`,
    revenue: await tx<{ paid: number }[]>`select coalesce(sum(amount),0) as paid from payments where status = 'succeeded'`,
    portfolio: await tx<{ mrr: number; kind: string }[]>`select mrr, kind from ops_portfolio_metrics()`,
    topSolutions: await tx<{ solution_slug: string; n: number; avg: number }[]>`select solution_slug, count(*)::int as n, round(avg(score))::int as avg from opportunity_scores group by solution_slug order by n desc limit 10`,
  }));
  const a = d.assess[0];
  const mrr = d.portfolio.filter((p) => p.kind === "client").reduce((s, p) => s + Number(p.mrr), 0);
  const order = ["new", "contacted", "qualified", "discovery", "diagnostic", "proposal", "won", "lost"];
  return (
    <>
      <PageTitle title="Analytics" description="First-party, consent-respecting business analytics. No third-party tracking." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Assessment completion" value={a.started ? `${Math.round((a.submitted / a.started) * 100)}%` : "—"} hint={`${a.submitted} of ${a.started}`} />
        <Kpi label="Chats" value={d.chat[0].total} hint={`${d.chat[0].handed} handed over`} />
        <Kpi label="Session revenue" value={formatMoney(Number(d.revenue[0].paid))} />
        <Kpi label="MRR" value={formatMoney(mrr)} />
        <Kpi label="ARR (run-rate)" value={formatMoney(mrr * 12)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Leads by source">
          <Table head={["Source", "Leads", "Won", "Win rate"]}>{d.bySource.map((s) => <tr key={s.source}><td className="px-3 py-2">{s.source}</td><td className="px-3 py-2">{s.leads}</td><td className="px-3 py-2">{s.won}</td><td className="px-3 py-2">{s.leads ? `${Math.round((s.won / s.leads) * 100)}%` : "—"}</td></tr>)}</Table>
        </Panel>
        <Panel title="Funnel by stage">
          <ul className="space-y-2 text-sm">
            {order.map((s) => {
              const n = d.funnel.find((f) => f.stage === s)?.n ?? 0;
              const max = Math.max(1, ...d.funnel.map((f) => f.n));
              return <li key={s}><div className="flex justify-between capitalize"><span>{s}</span><span>{n}</span></div><div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-copper" style={{ width: `${(n / max) * 100}%` }} /></div></li>;
            })}
          </ul>
        </Panel>
        <Panel title="Most recommended solutions">
          <Table head={["Solution", "Times", "Avg score"]}>{d.topSolutions.map((s) => <tr key={s.solution_slug}><td className="px-3 py-2 text-xs">{s.solution_slug}</td><td className="px-3 py-2">{s.n}</td><td className="px-3 py-2">{s.avg}</td></tr>)}</Table>
        </Panel>
      </div>
    </>
  );
}
