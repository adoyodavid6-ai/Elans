import { portal } from "@/lib/portal";
import { createTicket, replyToTicket } from "@/app/portal/actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";

export default async function Support() {
  const c = await portal();
  const d = await c.db(async (tx) => ({
    tickets: await tx<{ id: string; subject: string; priority: string; status: string; sla_due_at: Date | null; created_label: string | null; created_at: Date }[]>`select id, subject, priority, status, sla_due_at, created_label, created_at from tickets order by status in ('resolved','closed'), created_at desc limit 50`,
    messages: await tx<{ ticket_id: string; author_label: string; is_staff: boolean; body: string; created_at: Date }[]>`select ticket_id, author_label, is_staff, body, created_at from ticket_messages order by created_at`,
  }));
  return (
    <>
      <PageTitle title="Support" description="Raise anything with your Elans team. Response targets: urgent 2 h, high 8 h, normal 1 business day, low 3 business days." />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {d.tickets.length === 0 && <Panel><p className="text-sm text-muted">No tickets yet.</p></Panel>}
          {d.tickets.map((t) => {
            const msgs = d.messages.filter((m) => m.ticket_id === t.id);
            const open = t.status === "open" || t.status === "pending";
            return (
              <details key={t.id} open={open} className="rounded-2xl border border-line bg-surface p-4">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-heading">{t.subject}</span>
                  <span className="flex gap-1"><Badge tone={t.priority === "urgent" || t.priority === "high" ? "bad" : "neutral"}>{t.priority}</Badge><Badge tone={open ? "warn" : "good"}>{t.status}</Badge>{open && t.sla_due_at && <Badge tone={t.sla_due_at < new Date() ? "bad" : "info"}>reply due {relTime(t.sla_due_at)}</Badge>}</span>
                </summary>
                <ul className="mt-3 space-y-2">
                  {msgs.map((m, i) => <li key={i} className={`rounded-xl p-3 text-sm ${m.is_staff ? "bg-sand/50 dark:bg-surface-2" : "bg-surface-2"}`}><p className="text-xs text-muted">{m.author_label}{m.is_staff ? " (Elans)" : ""} · {relTime(m.created_at)}</p><p className="mt-1 whitespace-pre-wrap">{m.body}</p></li>)}
                </ul>
                {t.status !== "closed" && (
                  <form action={replyToTicket.bind(null, t.id)} className="mt-3 flex gap-2">
                    <label htmlFor={`r-${t.id}`} className="sr-only">Reply</label>
                    <input id={`r-${t.id}`} name="body" required placeholder="Add a reply…" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
                    <button className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Send</button>
                  </form>
                )}
              </details>
            );
          })}
        </div>
        <Panel title="New ticket">
          <form action={createTicket} className="space-y-3">
            <div><label htmlFor="subject" className="text-sm font-medium">Subject</label><input id="subject" name="subject" required maxLength={200} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></div>
            <div><label htmlFor="priority" className="text-sm font-medium">Priority</label>
              <select id="priority" name="priority" defaultValue="normal" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <option value="low">Low: question or idea</option><option value="normal">Normal: something isn&apos;t right</option><option value="high">High: an automation is not working</option><option value="urgent">Urgent: customers or money affected now</option>
              </select>
            </div>
            <div><label htmlFor="body" className="text-sm font-medium">What happened?</label><textarea id="body" name="body" required rows={5} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></div>
            <button className="w-full rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Raise ticket</button>
            <p className="text-xs text-muted">If customers or money are affected right now, you can also stop an automation instantly with its kill switch.</p>
          </form>
        </Panel>
      </div>
    </>
  );
}
