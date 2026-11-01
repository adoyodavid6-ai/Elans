import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { formatMoney } from "@/lib/core/money";
import { Badge, Kpi, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { Icon } from "@/components/ui/Icon";

type Item = { label: string; hint?: string; href: string; tone?: "bad" | "warn" };
type Group = { key: string; title: string; icon: string; href: string; empty: string; items: Item[]; count: number };

const fmtWhen = (d: Date) => d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });

export default async function OpsDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => {
    const [k] = await tx<{ leads7: number; leads30: number; assess7: number; pipeline: number; won: number; paid: number }[]>`
      select (select count(*)::int from leads where created_at > now() - interval '7 days') as leads7,
             (select count(*)::int from leads where created_at > now() - interval '30 days') as leads30,
             (select count(*)::int from assessments where submitted_at > now() - interval '7 days') as assess7,
             (select coalesce(sum(value),0) from opportunities where stage not in ('won','lost')) as pipeline,
             (select count(*)::int from opportunities where stage = 'won') as won,
             (select coalesce(sum(amount),0) from payments where status = 'succeeded' and created_at > now() - interval '30 days') as paid`;
    const newLeads = await tx<{ id: string; name: string | null; organisation: string | null; source: string; created_at: Date }[]>`
      select l.id, c.name, c.organisation, l.source, l.created_at from leads l left join contacts c on c.id = l.contact_id where l.stage = 'new' order by l.created_at limit 6`;
    const [{ n: newLeadCount }] = await tx<{ n: number }[]>`select count(*)::int as n from leads where stage = 'new'`;
    const followUps = await tx<{ id: string; name: string | null; organisation: string | null; next_action: string; next_action_due: string }[]>`
      select l.id, c.name, c.organisation, l.next_action, l.next_action_due::text from leads l left join contacts c on c.id = l.contact_id
      where l.next_action_due is not null and l.next_action_due <= (now() at time zone 'Africa/Nairobi')::date + 1 and l.stage not in ('won','lost')
      order by l.next_action_due limit 8`;
    const handoffs = await tx<{ id: string; visitor_ref: string | null; updated_at: Date }[]>`select id, visitor_ref, updated_at from conversations where status = 'handed_off' order by updated_at limit 6`;
    const sessions = await tx<{ id: string; type: string; starts_at: Date; name: string; organisation: string; status: string }[]>`
      select b.id, b.type, b.starts_at, c.name, c.organisation, b.status from bookings b join contacts c on c.id = b.contact_id
      where (b.starts_at at time zone 'Africa/Nairobi')::date between (now() at time zone 'Africa/Nairobi')::date and (now() at time zone 'Africa/Nairobi')::date + 1
        and b.status in ('confirmed','pending_payment') order by b.starts_at`;
    const assessments = await tx<{ id: string; organisation: string | null; submitted_at: Date }[]>`
      select a.id, c.organisation, a.submitted_at from assessments a left join leads l on l.id = a.lead_id left join contacts c on c.id = l.contact_id where a.state = 'submitted' order by a.submitted_at limit 5`;
    const reviews = await tx<{ id: string; tenant_id: string; tenant_name: string; title: string; sla_due_at: Date }[]>`select id, tenant_id, tenant_name, title, sla_due_at from ops_review_queue() where sla_due_at < now() + interval '2 hours' limit 6`;
    const tickets = await tx<{ id: string; tenant_id: string; tenant_name: string; subject: string; priority: string; sla_due_at: Date | null }[]>`
      select id, tenant_id, tenant_name, subject, priority, sla_due_at from ops_ticket_queue() where priority in ('urgent','high') or sla_due_at < now() limit 6`;
    const quotes = await tx<{ id: string; number: string; sent_at: Date; opp: string }[]>`
      select q.id, q.number, q.sent_at, o.name as opp from quotes q join opportunities o on o.id = q.opportunity_id where q.status = 'sent' and q.sent_at < now() - interval '7 days' order by q.sent_at limit 5`;
    const invoices = await tx<{ id: string; tenant_name: string; number: string; amount: number; due_date: string }[]>`select id, tenant_name, number, amount, due_date::text from ops_invoice_queue() where status = 'overdue' limit 5`;
    const portfolio = await tx<{ tenant_id: string; tenant_name: string; kind: string; active_instances: number; runs_7d: number; failed_7d: number; open_reviews: number; pending_approvals: number; open_incidents: number; mrr: number }[]>`select * from ops_portfolio_metrics()`;
    return { k, newLeads, newLeadCount, followUps, handoffs, sessions, assessments, reviews, tickets, quotes, invoices, portfolio };
  });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const groups: Group[] = [
    { key: "leads", title: "New leads to contact", icon: "users", href: "/ops/leads?stage=new", empty: "No new leads waiting.", count: d.newLeadCount,
      items: d.newLeads.map((l) => ({ label: l.organisation || l.name || "Unknown", hint: `${l.source} · waiting ${relTime(l.created_at).replace(" ago", "")}`, href: `/ops/leads/${l.id}`, tone: Date.now() - l.created_at.getTime() > 86400_000 ? "warn" : undefined })) },
    { key: "follow", title: "Follow-ups due", icon: "clock", href: "/ops/leads", empty: "No follow-ups due today or tomorrow.", count: d.followUps.length,
      items: d.followUps.map((f) => ({ label: `${f.organisation || f.name}: ${f.next_action}`, hint: f.next_action_due < today ? `overdue (${f.next_action_due})` : f.next_action_due === today ? "today" : "tomorrow", href: `/ops/leads/${f.id}`, tone: f.next_action_due < today ? "bad" : f.next_action_due === today ? "warn" : undefined })) },
    { key: "chat", title: "Chats waiting for a person", icon: "chat", href: "/ops/inbox", empty: "No customers waiting in chat.", count: d.handoffs.length,
      items: d.handoffs.map((h) => ({ label: "Website visitor", hint: `waiting ${relTime(h.updated_at).replace(" ago", "")}`, href: `/ops/inbox/${h.id}`, tone: "warn" })) },
    { key: "sessions", title: "Sessions today and tomorrow", icon: "calendar", href: "/ops/bookings", empty: "No sessions booked for today or tomorrow.", count: d.sessions.length,
      items: d.sessions.map((s) => ({ label: `${s.organisation} (${s.type})`, hint: `${fmtWhen(s.starts_at)}${s.status === "pending_payment" ? " · payment pending" : ""}`, href: "/ops/bookings", tone: s.status === "pending_payment" ? "warn" : undefined })) },
    { key: "assess", title: "Assessments to review", icon: "spark", href: "/ops/assessments", empty: "All assessments reviewed.", count: d.assessments.length,
      items: d.assessments.map((a) => ({ label: a.organisation ?? "Assessment", hint: `submitted ${relTime(a.submitted_at)}`, href: `/ops/assessments/${a.id}` })) },
    { key: "reviews", title: "Client reviews near SLA", icon: "shield", href: "/ops/operations", empty: "No review items near their deadline.", count: d.reviews.length,
      items: d.reviews.map((r) => ({ label: `${r.tenant_name}: ${r.title}`, hint: r.sla_due_at < new Date() ? `overdue by ${relTime(r.sla_due_at).replace(" ago", "")}` : `due ${relTime(r.sla_due_at)}`, href: `/ops/clients/${r.tenant_id}`, tone: r.sla_due_at < new Date() ? "bad" : "warn" })) },
    { key: "tickets", title: "Urgent support tickets", icon: "inbox", href: "/ops/operations", empty: "No urgent or overdue tickets.", count: d.tickets.length,
      items: d.tickets.map((t) => ({ label: `${t.tenant_name}: ${t.subject}`, hint: t.sla_due_at && t.sla_due_at < new Date() ? `${t.priority} · reply overdue` : t.priority, href: `/ops/clients/${t.tenant_id}`, tone: t.priority === "urgent" ? "bad" : "warn" })) },
    { key: "quotes", title: "Quotes waiting over 7 days", icon: "doc", href: "/ops/contracts", empty: "No stale proposals.", count: d.quotes.length,
      items: d.quotes.map((q) => ({ label: `${q.number} · ${q.opp}`, hint: `sent ${relTime(q.sent_at)}`, href: `/ops/quotes/${q.id}` })) },
    { key: "invoices", title: "Overdue client invoices", icon: "money", href: "/ops/billing?status=overdue", empty: "No overdue invoices.", count: d.invoices.length,
      items: d.invoices.map((i) => ({ label: `${i.tenant_name}: ${i.number}`, hint: `${formatMoney(Number(i.amount))} · due ${i.due_date}`, href: "/ops/billing?status=overdue", tone: "bad" })) },
  ];
  const active = groups.filter((g) => g.count > 0);
  const done = groups.filter((g) => g.count === 0);
  const mrr = d.portfolio.filter((p) => p.kind === "client").reduce((s, p) => s + Number(p.mrr), 0);
  const issues = d.portfolio.reduce((s, p) => s + Number(p.open_incidents), 0);
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Nairobi" }));
  const canSell = ["admin", "consultant", "support"].includes(u.staffRole ?? "");
  const canBill = ["admin", "consultant"].includes(u.staffRole ?? "");

  return (
    <>
      <PageTitle title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${u.name.split(" ")[0]}`} description={active.length ? `${active.reduce((s, g) => s + g.count, 0)} things need attention across ${active.length} areas.` : "You're all caught up. Nothing needs attention right now."} />
      {denied && <p className="mb-4 rounded-xl bg-warning-bg p-3 text-sm text-warning">Your role ({u.staffRole}) doesn&apos;t have access to that page. Ask an admin if you need it.</p>}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {canSell && <QuickAction href="/ops/leads/new" icon="plus" label="Add a lead" />}
        {canBill && <QuickAction href="/ops/clients/new" icon="building" label="New client" />}
        {canBill && <QuickAction href="/ops/billing#new" icon="money" label="Issue an invoice" />}
        {canBill && <QuickAction href="/ops/documents/new?kind=quotation" icon="doc" label="New quotation" />}
        <QuickAction href="/ops/content" icon="doc" label="Edit website content" />
      </div>

      <section aria-labelledby="today-h">
        <h2 id="today-h" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Today</h2>
        {active.length === 0 ? (
          <Panel><p className="flex items-center gap-2 text-sm"><Icon name="check" size={18} className="text-success" /> All queues are clear.</p></Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((g) => (
              <Panel key={g.key} title={<span className="flex items-center gap-2"><Icon name={g.icon} size={17} className="text-copper-ink" />{g.title} <Badge tone={g.items.some((i) => i.tone === "bad") ? "bad" : "warn"}>{g.count}</Badge></span>} actions={<Link href={g.href} className="text-sm text-copper-ink hover:underline">Open</Link>}>
                <ul className="divide-y divide-line">
                  {g.items.slice(0, 5).map((i, n) => (
                    <li key={n}>
                      <Link href={i.href} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-copper-ink">
                        <span className="min-w-0 truncate font-medium text-heading">{i.label}</span>
                        <span className={`shrink-0 text-xs ${i.tone === "bad" ? "font-semibold text-danger" : i.tone === "warn" ? "text-warning" : "text-muted"}`}>{i.hint}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {g.count > 5 && <p className="mt-2 text-xs text-muted">and {g.count - 5} more</p>}
              </Panel>
            ))}
          </div>
        )}
        {done.length > 0 && active.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1"><Icon name="check" size={14} className="text-success" /> Clear:</span>
            {done.map((g) => <span key={g.key}>{g.title.toLowerCase()}</span>)}
          </p>
        )}
      </section>

      <section aria-labelledby="numbers-h" className="mt-8">
        <h2 id="numbers-h" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">The numbers</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Leads (7 days)" value={d.k.leads7} hint={`${d.k.leads30} in 30 days`} href="/ops/leads" />
          <Kpi label="Assessments (7 days)" value={d.k.assess7} href="/ops/assessments" />
          <Kpi label="Open pipeline" value={formatMoney(Number(d.k.pipeline), "KES", { compact: true })} hint={`${d.k.won} deals won`} href="/ops/pipeline" />
          <Kpi label="Client MRR" value={formatMoney(mrr, "KES", { compact: true })} hint="Active subscriptions" href="/ops/clients" />
          <Kpi label="Payments (30 days)" value={formatMoney(Number(d.k.paid), "KES", { compact: true })} hint="Sessions and deposits" />
          <Kpi label="Open incidents" value={issues} tone={issues ? "bad" : "good"} href="/ops/operations" />
        </div>
      </section>

      <Panel title="Client portfolio health" className="mt-8" actions={<Link href="/ops/clients" className="text-sm text-copper-ink hover:underline">All clients</Link>}>
        <Table head={["Client", "Automations", "Runs (7d)", "Failed", "Reviews", "Approvals", "Incidents", "MRR"]} empty="No clients yet. Create one from an accepted quote or with New client.">
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

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg bg-surface px-3.5 py-2 text-sm font-semibold text-heading ring-1 ring-line hover:bg-surface-2 hover:ring-sand-strong">
      <Icon name={icon} size={16} className="text-copper-ink" /> {label}
    </Link>
  );
}
