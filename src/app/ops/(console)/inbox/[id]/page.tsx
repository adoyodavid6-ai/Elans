import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { closeConversation, replyToConversation, returnToAgent } from "@/app/ops/actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { AutoRefresh } from "@/components/app/AutoRefresh";

type Props = { params: Promise<{ id: string }> };

export default async function Conversation({ params }: Props) {
  const { id } = await params;
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => {
    const [c] = await tx<{ id: string; status: string; language: string; created_at: Date; meta: Record<string, unknown> }[]>`select id, status, language, created_at, meta from conversations where id = ${id}`;
    if (!c) return null;
    const msgs = await tx<{ author: string; body: string; created_at: Date; meta: { generator?: string; intent?: string; staff?: string } }[]>`select author, body, created_at, meta from messages where conversation_id = ${id} order by created_at`;
    const handoffs = await tx<{ reason: string; requested_at: Date; callback_requested: boolean; accepted_at: Date | null }[]>`select reason, requested_at, callback_requested, accepted_at from handoffs where conversation_id = ${id}`;
    return { c, msgs, handoffs };
  });
  if (!d) notFound();
  return (
    <>
      <AutoRefresh seconds={6} />
      <PageTitle crumbs={[{ href: "/ops/inbox", label: "Inbox" }]} title="Conversation" description={`Started ${relTime(d.c.created_at)} · language ${d.c.language.toUpperCase()} · first page ${String(d.c.meta?.firstPage ?? "?")}`} actions={<Badge tone={d.c.status === "handed_off" ? "warn" : d.c.status === "closed" ? "neutral" : "info"}>{d.c.status}</Badge>} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Transcript">
          <ol className="space-y-3">
            {d.msgs.map((m, i) => (
              <li key={i} className={`flex ${m.author === "customer" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${m.author === "customer" ? "bg-surface-2" : m.author === "human" ? "bg-success-bg" : "bg-copper/10"}`}>
                  <p className="mb-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{m.author === "customer" ? "Visitor" : m.author === "human" ? `Team · ${m.meta?.staff ?? ""}` : `Agent · ${m.meta?.intent ?? ""} · ${m.meta?.generator ?? ""}`}</p>
                  <p className="whitespace-pre-line">{m.body}</p>
                  <p className="mt-1 text-[0.65rem] text-muted">{m.created_at.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" })}</p>
                </div>
              </li>
            ))}
          </ol>
          {d.c.status !== "closed" && (
            <form action={replyToConversation.bind(null, id)} className="mt-5 flex gap-2 border-t border-line pt-4">
              <label htmlFor="reply" className="sr-only">Reply</label>
              <input id="reply" name="body" placeholder="Reply as the Elans team (taking over from the agent)" className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" autoFocus />
              <button className="rounded-lg bg-brown px-4 text-sm font-semibold text-white">Send</button>
            </form>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Handover">
            {d.handoffs.length === 0 ? <p className="text-sm text-muted">No handover requested.</p> : d.handoffs.map((h, i) => <p key={i} className="text-sm">{h.callback_requested ? "Callback requested" : "Live handover"} · {relTime(h.requested_at)} · {h.accepted_at ? "accepted" : <strong>waiting</strong>}<br /><span className="text-muted">{h.reason}</span></p>)}
          </Panel>
          {d.c.status !== "closed" && (
            <Panel title="Actions">
              <div className="flex flex-col gap-2">
                {d.c.status === "handed_off" && <form action={returnToAgent.bind(null, id)}><button className="w-full rounded-lg bg-surface-2 py-2 text-sm font-semibold ring-1 ring-line">Return to agent</button></form>}
                <form action={closeConversation.bind(null, id, "resolved")}><button className="w-full rounded-lg bg-success py-2 text-sm font-semibold text-white">Close as resolved</button></form>
                <form action={closeConversation.bind(null, id, "abandoned")}><button className="w-full rounded-lg bg-surface-2 py-2 text-sm font-semibold ring-1 ring-line">Close as abandoned</button></form>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
