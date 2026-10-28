import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { formatMoney } from "@/lib/core/money";
import { Badge, Kpi, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { EmptyState } from "@/components/ui/primitives";

export default async function OpsDashboard() {
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => {
    const [k] = await tx<{ leads7: number; leads30: number; assess7: number; pipeline: number; won: number; handoffs: number; upcoming: number; paid: number }[]>`
      select (select count(*)::int from leads where created_at > now() - interval '7 days') as leads7,
             (select count(*)::int from leads where created_at > now() - interval '30 days') as leads30,
             (select count(*)::int from assessments where submitted_at > now() - interval '7 days') as assess7,
             (select coalesce(sum(value),0) from opportunities where stage not in ('won','lost')) as pipeline,
             (select count(*)::int from opportunities where stage = 'won') as won,
             (select count(*)::int from conversations where status = 'handed_off') as handoffs,
             (select count(*)::int from bookings where starts_at > now() and status = 'confirmed') as upcoming,
             (select coalesce(sum(amount),0) from payments where status = 'succeeded' and created_at > now() - interval '30 days') as paid`;
    const portfolio = await tx<{ tenant_id: string; tenant_name: string; kind: string; active_instances: number; runs_7d: number; failed_7d: number; open_reviews: number; pending_approvals: number; open_incidents: number; mrr: number }[]>`select * from ops_portfolio_metrics()`;
    const recent = await tx<{ id: string; name: string | null; organisation: string | null; source: string; score: number; created_at: Date; stage: string }[]>`
      select l.id, c.name, c.organisation, l.source, l.score, l.created_at, l.stage from leads l left join contacts c on c.id = l.contact_id order by l.created_at desc limit 8`;
    const bookings = await tx<{ id: string; type: string; starts_at: Date; name: string; organisation: string; status: string }[]>`
      select b.id, b.type, b.starts_at, c.name, c.organisation, b.status from bookings b join contacts c on c.id = b.contact_id where b.starts_at > now() - interval '1 day' and b.status in ('confirmed','pending_payment') order by b.starts_at limit 6`;
    return { k, portfolio, recent, bookings };
  });
  const mrr = d.portfolio.filter((p) => p.kind === "client").reduce((s, p) => s + Number(p.mrr), 0);
  const issues = d.portfolio.reduce((s, p) => s + Number(p.open_incidents), 0);
  return (
    <>
      <PageTitle title={`Good ${new Date().getUTCHours() + 3 < 12 ? "morning" : "afternoon"}, ${u.name.split(" ")[0]}`} description="Sales, delivery and platform health at a glance." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Leads (7d)" value={d.k.leads7} hint={`${d.k.leads30} in 30 days`} href="/ops/leads" />
        <Kpi label="Assessments (7d)" value={d.k.assess7} href="/ops/assessments" />
        <Kpi label="Open pipeline" value={formatMoney(Number(d.k.pipeline), "KES", { compact: true })} href="/ops/pipeline" />
        <Kpi label="Won deals" value={d.k.won} />
        <Kpi label="Client MRR" value={formatMoney(mrr, "KES", { compact: true })} hint="Active subscriptions" href="/ops/clients" />
        <Kpi label="Chat handovers" value={d.k.handoffs} tone={d.k.handoffs ? "warn" : undefined} href="/ops/inbox" />
        <Kpi label="Upcoming sessions" value={d.k.upcoming} href="/ops/bookings" />
        <Kpi label="Open incidents" value={issues} tone={issues ? "bad" : "good"} href="/ops/operations" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Newest leads" actions={<Link href="/ops/leads" className="text-sm text-copper-ink hover:underline">All leads</Link>}>
          {d.recent.length === 0 ? (
            <EmptyState title="No leads yet">Leads from the assessment, calculators, chat and bookings appear here.</EmptyState>
          ) : (
            <Table head={["Lead", "Source", "Score", "Stage", "When"]}>
              {d.recent.map((l) => (
                <tr key={l.id} className="hover:bg-surface-2">
                  <td className="px-3 py-2.5"><Link href={`/ops/leads/${l.id}`} className="font-medium text-heading hover:underline">{l.organisation || l.name || "Unknown"}</Link><p className="text-xs text-muted">{l.name}</p></td>
                  <td className="px-3 py-2.5"><Badge tone="brand">{l.source}</Badge></td>
                  <td className="px-3 py-2.5">{l.score}</td>
                  <td className="px-3 py-2.5 capitalize">{l.stage}</td>
                  <td className="px-3 py-2.5 text-muted">{relTime(l.created_at)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
        <Panel title="Upcoming sessions" actions={<Link href="/ops/bookings" className="text-sm text-copper-ink hover:underline">All</Link>}>
          {d.bookings.length === 0 ? (
            <p className="text-sm text-muted">No sessions booked.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-heading">{b.organisation}</p>
                    <p className="text-xs text-muted">{b.name} · <span className="capitalize">{b.type}</span></p>
                  </div>
                  <div className="text-right">
                    <p>{b.starts_at.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })}</p>
                    <Badge tone={b.status === "confirmed" ? "good" : "warn"}>{b.status.replace("_", " ")}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Client portfolio health" className="mt-6" actions={<Link href="/ops/clients" className="text-sm text-copper-ink hover:underline">Clients</Link>}>
        <Table head={["Client", "Automations", "Runs (7d)", "Failed", "Reviews", "Approvals", "Incidents", "MRR"]}>
          {d.portfolio.map((p) => (
            <tr key={p.tenant_id} className="hover:bg-surface-2">
              <td className="px-3 py-2.5"><Link href={`/ops/clients/${p.tenant_id}`} className="font-medium text-heading hover:underline">{p.tenant_name}</Link> {p.kind === "demo" && <Badge>demo</Badge>}</td>
              <td className="px-3 py-2.5">{p.active_instances}</td>
              <td className="px-3 py-2.5">{p.runs_7d}</td>
              <td className="px-3 py-2.5">{Number(p.failed_7d) > 0 ? <Badge tone="bad">{p.failed_7d}</Badge> : 0}</td>
              <td className="px-3 py-2.5">{p.open_reviews}</td>
              <td className="px-3 py-2.5">{p.pending_approvals}</td>
              <td className="px-3 py-2.5">{Number(p.open_incidents) > 0 ? <Badge tone="bad">{p.open_incidents}</Badge> : 0}</td>
              <td className="px-3 py-2.5">{formatMoney(Number(p.mrr))}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
