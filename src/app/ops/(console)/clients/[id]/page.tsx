import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { activeGrant, withClientAccess } from "@/lib/ops/access";
import { decideReview, replyTicket, requestAccess, resolveIncident } from "@/app/ops/actions";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { Callout } from "@/components/ui/primitives";
import { FIELD_LABELS } from "@/lib/solutions/etims/extract";

type Props = { params: Promise<{ id: string }> };

export default async function ClientDetail({ params }: Props) {
  const { id } = await params;
  const u = await requireStaff();
  const meta = await asStaff(u, async (tx) => (await tx<{ tenant_name: string; kind: string; mrr: number }[]>`select tenant_name, kind, mrr from ops_portfolio_metrics() where tenant_id = ${id}`)[0]);
  if (!meta) notFound();
  const grant = await activeGrant(u, id);

  if (!grant) {
    return (
      <>
        <PageTitle crumbs={[{ href: "/ops/clients", label: "Clients" }]} title={meta.tenant_name} />
        <Panel title="Access required">
          <p className="mb-4 max-w-2xl text-sm text-muted">Client data is isolated. State why you need access; a grant valid for 4 hours is created and recorded in this client&apos;s audit log, which they can see.</p>
          <form action={requestAccess.bind(null, id)} className="flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label htmlFor="reason" className="sr-only">Reason</label>
            <input id="reason" name="reason" required minLength={8} placeholder="e.g. Work Elans review queue; investigate failed run" className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
            <button className="rounded-lg bg-brown px-4 text-sm font-semibold text-white">Request access</button>
          </form>
        </Panel>
      </>
    );
  }

  const d = await withClientAccess(u, id, "read:client.overview", async (tx) => ({
    instances: await tx<{ id: string; name: string; solution_slug: string; status: string; kill_switch: boolean }[]>`select id, name, solution_slug, status, kill_switch from engine_instances order by created_at`,
    runs: await tx<{ id: string; trigger: string; status: string; started_at: Date; error: string | null; name: string }[]>`select r.id, r.trigger, r.status, r.started_at, r.error, e.name from runs r join engine_instances e on e.id = r.engine_instance_id order by r.started_at desc limit 15`,
    reviews: await tx<{ id: string; kind: string; title: string; payload: Record<string, unknown>; sla_due_at: Date; queue: string }[]>`select id, kind, title, payload, sla_due_at, queue from review_items where status = 'open' order by sla_due_at limit 20`,
    incidents: await tx<{ id: string; severity: string; title: string; detail: string | null; opened_at: Date; status: string }[]>`select id, severity, title, detail, opened_at, status from incidents where status <> 'resolved' order by opened_at desc`,
    tickets: await tx<{ id: string; subject: string; priority: string; status: string; created_at: Date; created_label: string | null }[]>`select id, subject, priority, status, created_at, created_label from tickets where status in ('open','pending') order by created_at desc`,
    ticketMsgs: await tx<{ ticket_id: string; author_label: string; body: string; created_at: Date }[]>`select ticket_id, author_label, body, created_at from ticket_messages order by created_at`,
    audit: await tx<{ actor_label: string | null; action: string; created_at: Date }[]>`select actor_label, action, created_at from audit_log order by created_at desc limit 12`,
  }));
  if (!d) notFound();
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/clients", label: "Clients" }]} title={meta.tenant_name} description={`Access granted until ${grant.expires_at.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" })} EAT · reason: ${grant.reason}`} actions={<Badge tone="brand">{meta.kind}</Badge>} />
      {meta.kind === "demo" && <Callout tone="info" className="mb-6">This is the illustrative demo tenant. Its data is synthetic.</Callout>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Elans review queue (${d.reviews.length})`}>
          {d.reviews.length === 0 ? <p className="text-sm text-muted">Nothing waiting.</p> : (
            <ul className="space-y-4">
              {d.reviews.map((r) => {
                const p = r.payload as { fields?: Record<string, unknown>; confidence?: Record<string, number>; flags?: string[]; candidates?: { receivableId: string; number: string; customer: string; confidence: number }[] };
                return (
                  <li key={r.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-start justify-between gap-2"><p className="font-medium">{r.title}</p><Badge tone={r.sla_due_at < new Date() ? "bad" : "neutral"}>SLA {relTime(r.sla_due_at)}</Badge></div>
                    <p className="text-xs text-muted">{r.kind} · {r.queue} queue</p>
                    {p.flags && p.flags.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-warning">{p.flags.map((f) => <li key={f}>{f}</li>)}</ul>}
                    {p.fields && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {Object.entries(p.fields).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{FIELD_LABELS[k as keyof typeof FIELD_LABELS] ?? k}</dt><dd className={(p.confidence?.[k] ?? 1) < 0.85 ? "font-semibold text-danger" : ""}>{String(v ?? "—")} <span className="text-muted">{p.confidence?.[k] !== undefined ? `(${p.confidence[k].toFixed(2)})` : ""}</span></dd></div>)}
                      </dl>
                    )}
                    {p.candidates && <ul className="mt-2 text-xs">{p.candidates.map((c) => <li key={c.receivableId}>{c.number} · {c.customer} · {c.confidence}</li>)}</ul>}
                    <form action={decideReview.bind(null, id, r.id)} className="mt-3 space-y-2">
                      <textarea name="correction" placeholder={r.kind === "recon.match" ? '{"receivableId": "…"}' : '{"cuInvoiceNo": "…"} (only fields to correct)'} className="h-16 w-full rounded-lg border border-line bg-surface p-2 font-mono text-xs" aria-label="Correction JSON" />
                      <div className="flex gap-2">
                        <button name="decision" value="accept" className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white">Accept</button>
                        <button name="decision" value="correct" className="rounded-lg bg-brown px-3 py-1.5 text-xs font-semibold text-white">Apply correction</button>
                        <button name="decision" value="reject" className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold ring-1 ring-line">Reject</button>
                      </div>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Automations">
            <ul className="space-y-1 text-sm">{d.instances.map((i) => <li key={i.id} className="flex justify-between"><span>{i.name}</span><span><Badge tone={i.status === "live" ? "good" : "info"}>{i.status}</Badge>{i.kill_switch && <Badge tone="bad">killed</Badge>}</span></li>)}</ul>
          </Panel>
          <Panel title="Incidents">
            {d.incidents.length === 0 ? <p className="text-sm text-muted">No open incidents.</p> : d.incidents.map((i) => (
              <div key={i.id} className="mb-3 flex items-start justify-between gap-3 text-sm">
                <div><Badge tone="bad">{i.severity}</Badge> <strong>{i.title}</strong><p className="text-xs text-muted">{i.detail} · {relTime(i.opened_at)}</p></div>
                <form action={resolveIncident.bind(null, id, i.id)}><button className="rounded-md bg-surface-2 px-2 py-1 text-xs ring-1 ring-line">Resolve</button></form>
              </div>
            ))}
          </Panel>
          <Panel title="Support tickets">
            {d.tickets.length === 0 ? <p className="text-sm text-muted">No open tickets.</p> : d.tickets.map((t) => (
              <div key={t.id} className="mb-4 rounded-xl border border-line p-3 text-sm">
                <p className="font-medium">{t.subject} <Badge tone={t.priority === "urgent" || t.priority === "high" ? "bad" : "neutral"}>{t.priority}</Badge></p>
                <ul className="mt-2 space-y-1 text-xs">{d.ticketMsgs.filter((m) => m.ticket_id === t.id).map((m, i) => <li key={i}><strong>{m.author_label}:</strong> {m.body}</li>)}</ul>
                <form action={replyTicket.bind(null, id, t.id)} className="mt-2 flex gap-2">
                  <input name="body" placeholder="Reply" className="h-9 flex-1 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Reply" />
                  <select name="status" defaultValue="pending" className="h-9 rounded-lg border border-line bg-surface text-xs" aria-label="Status"><option value="pending">pending</option><option value="resolved">resolved</option></select>
                  <button className="rounded-lg bg-brown px-3 text-xs font-semibold text-white">Send</button>
                </form>
              </div>
            ))}
          </Panel>
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Recent runs">
          <Table head={["Automation", "Trigger", "Status", "Started"]}>
            {d.runs.map((r) => <tr key={r.id}><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 text-xs">{r.trigger}</td><td className="px-3 py-2"><Badge tone={r.status === "succeeded" ? "good" : r.status === "failed" ? "bad" : r.status.startsWith("waiting") ? "warn" : "neutral"}>{r.status}</Badge></td><td className="px-3 py-2 text-muted">{relTime(r.started_at)}</td></tr>)}
          </Table>
        </Panel>
        <Panel title="Audit log (visible to the client)">
          <ul className="space-y-1.5 text-xs">{d.audit.map((a, i) => <li key={i}><span className="text-muted">{relTime(a.created_at)}</span> · {a.actor_label} · <strong>{a.action}</strong></li>)}</ul>
          <Link href="#" className="hidden">.</Link>
        </Panel>
      </div>
    </>
  );
}
