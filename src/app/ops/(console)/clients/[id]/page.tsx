import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { activeGrant, withClientAccess } from "@/lib/ops/access";
import { decideReview, replyTicket, requestAccess, resolveIncident } from "@/app/ops/actions";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { Callout } from "@/components/ui/primitives";
import { FIELD_LABELS } from "@/lib/solutions/etims/extract";
import { createInvoice, inviteClientMember, setAutomationState, setInvoiceStatus } from "@/app/ops/console-actions";
import { Input, Select, SubmitButton } from "@/components/app/Form";
import { formatMoney } from "@/lib/core/money";

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
    members: await tx<{ user_id: string; name: string; email: string; role: string; mfa_enabled: boolean; last_login_at: Date | null }[]>`select * from tenant_members()`,
    invites: await tx<{ email: string; role: string; expires_at: Date }[]>`select email, role, expires_at from invites where accepted_at is null and expires_at > now() order by created_at desc`,
  }));
  const invoices = await asStaff(u, (tx) => tx<{ id: string; number: string; status: string; amount: number; currency: string; description: string; due_date: string; paid_at: Date | null }[]>`select id, number, status, amount, currency, description, due_date::text, paid_at from ops_invoice_queue() where tenant_id = ${id}`);
  const canBill = u.staffRole === "admin" || u.staffRole === "consultant";
  const canControl = u.staffRole === "admin" || u.staffRole === "engineer";
  const in30 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
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
            {d.instances.length === 0 ? <p className="text-sm text-muted">No automations configured yet.</p> : (
              <ul className="divide-y divide-line">
                {d.instances.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="font-medium">{i.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={i.status === "live" ? "good" : i.status === "paused" ? "warn" : "info"}>{i.status}</Badge>
                      {i.kill_switch && <Badge tone="bad">kill switch on</Badge>}
                      {canControl && (
                        <>
                          {i.status === "paused"
                            ? <form action={setAutomationState.bind(null, id, i.id, "resume")}><SubmitButton tone="secondary" className="h-7 px-2 text-xs" pendingText="…">Resume</SubmitButton></form>
                            : <form action={setAutomationState.bind(null, id, i.id, "pause")}><SubmitButton tone="secondary" className="h-7 px-2 text-xs" pendingText="…">Pause</SubmitButton></form>}
                          <form action={setAutomationState.bind(null, id, i.id, i.kill_switch ? "unkill" : "kill")}><SubmitButton tone={i.kill_switch ? "success" : "danger"} className="h-7 px-2 text-xs" pendingText="…">{i.kill_switch ? "Kill switch off" : "Kill switch"}</SubmitButton></form>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">Every change is recorded in the client&apos;s audit log. {canControl ? "" : "Engineers and admins can pause or stop automations."}</p>
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
        <Panel title={`Team (${d.members.length})`}>
          <ul className="divide-y divide-line text-sm">
            {d.members.map((m) => <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><span className="font-medium">{m.name}</span> <span className="text-xs text-muted">{m.email}</span></span><span className="flex gap-1"><Badge tone="brand">{m.role}</Badge>{m.mfa_enabled ? <Badge tone="good">2-step on</Badge> : <Badge tone={["owner", "admin"].includes(m.role) ? "bad" : "neutral"}>2-step off</Badge>}</span></li>)}
            {d.invites.map((i) => <li key={i.email} className="flex flex-wrap items-center justify-between gap-2 py-2 text-muted"><span>{i.email}</span><span className="text-xs">invited · {i.role} · expires {relTime(i.expires_at)}</span></li>)}
            {d.members.length + d.invites.length === 0 && <li className="py-2 text-muted">No members yet.</li>}
          </ul>
          <form action={inviteClientMember.bind(null, id)} className="mt-3 flex flex-wrap gap-2">
            <label htmlFor="inv-email" className="sr-only">Email</label>
            <Input id="inv-email" name="email" type="email" required placeholder="name@client.co.ke" className="min-w-0 flex-1" />
            <label htmlFor="inv-role" className="sr-only">Role</label>
            <Select id="inv-role" name="role" defaultValue="member" className="w-32">{["owner", "admin", "approver", "member", "viewer"].map((r) => <option key={r} value={r}>{r}</option>)}</Select>
            <SubmitButton pendingText="Sending…">Invite</SubmitButton>
          </form>
        </Panel>
        <Panel title={`Invoices (${invoices.length})`} actions={<Link href="/ops/billing" className="text-sm text-copper-ink hover:underline">All billing</Link>}>
          <Table head={["Invoice", "Amount", "Due", "Status", ""]} empty="No invoices yet.">
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2"><p className="font-medium">{i.number}</p><p className="max-w-[12rem] truncate text-xs text-muted">{i.description}</p></td>
                <td className="whitespace-nowrap px-3 py-2">{formatMoney(Number(i.amount), i.currency)}</td>
                <td className="px-3 py-2 text-xs">{i.due_date}</td>
                <td className="px-3 py-2"><Badge tone={i.status === "paid" ? "good" : i.status === "overdue" ? "bad" : i.status === "void" ? "neutral" : "warn"}>{i.status}</Badge></td>
                <td className="px-3 py-2">{canBill && (i.status === "issued" || i.status === "overdue") && <form action={setInvoiceStatus.bind(null, i.id, "paid")}><SubmitButton tone="secondary" className="h-7 px-2 text-xs" pendingText="…">Mark paid</SubmitButton></form>}</td>
              </tr>
            ))}
          </Table>
          {canBill && (
            <form action={createInvoice} className="mt-4 grid gap-2 rounded-xl bg-teal-50 p-3 sm:grid-cols-[1fr_8rem_9rem_auto]">
              <input type="hidden" name="tenantId" value={id} /><input type="hidden" name="back" value={`/ops/clients/${id}`} />
              <label className="sr-only" htmlFor="inv-desc">Description</label><Input id="inv-desc" name="description" required placeholder="e.g. Growth retainer, December 2026" />
              <label className="sr-only" htmlFor="inv-amt">Amount</label><Input id="inv-amt" name="amount" type="number" min={1} step="0.01" required placeholder="Amount" />
              <label className="sr-only" htmlFor="inv-due">Due date</label><Input id="inv-due" name="dueDate" type="date" required defaultValue={in30} />
              <SubmitButton pendingText="Issuing…">Issue</SubmitButton>
            </form>
          )}
        </Panel>
        <Panel title="Audit log (visible to the client)">
          <ul className="space-y-1.5 text-xs">{d.audit.map((a, i) => <li key={i}><span className="text-muted">{relTime(a.created_at)}</span> · {a.actor_label} · <strong>{a.action}</strong></li>)}</ul>
        </Panel>
      </div>
    </>
  );
}
