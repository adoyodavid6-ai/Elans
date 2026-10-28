import Link from "next/link";
import { portal } from "@/lib/portal";
import { releaseConversation, simulateCustomerMessage, staffReply } from "@/app/portal/actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";
import { EmptyState } from "@/components/ui/primitives";

type Props = { searchParams: Promise<{ c?: string; f?: string }> };
const SUGGESTIONS = ["Hi, how much is cement?", "I want 20 bags of cement", "Nataka mabati 10", "Where are you located?", "Do you deliver to Kitengela?", "I'd like to speak to a person"];

export default async function Conversations({ searchParams }: Props) {
  const { c: selected, f } = await searchParams;
  const c = await portal();
  const d = await c.db(async (tx) => {
    const [agent] = await tx<{ id: string; name: string; kill_switch: boolean }[]>`select id, name, kill_switch from engine_instances where solution_slug = 'whatsapp-sales-support-agent' limit 1`;
    const convs = await tx<{ id: string; channel: string; visitor_ref: string | null; status: string; resolution: string | null; language: string; updated_at: Date; last: string | null; n: number }[]>`
      select c.id, c.channel, c.visitor_ref, c.status, c.resolution, c.language, c.updated_at,
        (select body from messages m where m.conversation_id = c.id order by created_at desc limit 1) as last,
        (select count(*)::int from messages m where m.conversation_id = c.id) as n
      from conversations c where (${f ?? "all"} = 'all' or c.status = ${f ?? "all"}) order by c.updated_at desc limit 100`;
    const sel = selected && /^[0-9a-f-]{36}$/.test(selected) ? selected : null;
    const msgs = sel ? await tx<{ id: string; direction: string; author: string; body: string; meta: Record<string, unknown>; created_at: Date }[]>`select id, direction, author, body, meta, created_at from messages where conversation_id = ${sel} order by created_at` : [];
    const [conv] = sel ? await tx<{ id: string; status: string; visitor_ref: string | null; meta: { pendingOrder?: { sku: string; qty: number; total: number } } }[]>`select id, status, visitor_ref, meta from conversations where id = ${sel}` : [];
    const [stats] = await tx<{ total: number; resolved: number; handed: number }[]>`select count(*)::int as total, count(*) filter (where resolution = 'resolved')::int as resolved, count(*) filter (where status = 'handed_off')::int as handed from conversations`;
    return { agent, convs, msgs, conv, stats };
  });
  const filters = [["all", "All"], ["open", "Open"], ["handed_off", "Needs a person"], ["closed", "Closed"]];
  return (
    <>
      <PageTitle title="Agents & Conversations" description={`${d.stats.total} conversations · ${d.stats.resolved} resolved by the agent · ${d.stats.handed} waiting for a person. Try the agent as a customer would with the simulator.`} />
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <Panel title="Conversations" className="xl:max-h-[75vh] xl:overflow-auto">
          <div className="mb-3 flex flex-wrap gap-1">
            {filters.map(([k, l]) => <Link key={k} href={`/portal/conversations?f=${k}`} aria-current={(f ?? "all") === k ? "page" : undefined} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${(f ?? "all") === k ? "bg-brown text-white ring-brown" : "ring-line"}`}>{l}</Link>)}
          </div>
          <Link href="/portal/conversations" className="mb-3 block rounded-xl border border-dashed border-line p-3 text-center text-sm font-semibold text-copper-ink">+ New simulated WhatsApp chat</Link>
          {d.convs.length === 0 ? <p className="text-sm text-muted">No conversations yet.</p> : (
            <ul className="space-y-1">
              {d.convs.map((cv) => (
                <li key={cv.id}>
                  <Link href={`/portal/conversations?c=${cv.id}${f ? `&f=${f}` : ""}`} className={`block rounded-xl p-3 ${cv.id === selected ? "bg-surface-2 ring-1 ring-line" : "hover:bg-surface-2"}`}>
                    <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs">{cv.visitor_ref ?? cv.channel}</span><Badge tone={cv.status === "handed_off" ? "warn" : cv.resolution === "resolved" ? "good" : cv.status === "closed" ? "neutral" : "info"}>{cv.status === "handed_off" ? "needs a person" : cv.resolution ?? cv.status}</Badge></div>
                    <p className="mt-1 truncate text-sm text-muted">{cv.last}</p>
                    <p className="text-xs text-muted">{cv.channel} · {cv.n} messages · {relTime(cv.updated_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={d.conv ? `Chat with ${d.conv.visitor_ref ?? "customer"}` : "WhatsApp simulator"} actions={d.conv?.status === "handed_off" ? <form action={releaseConversation.bind(null, d.conv.id)}><button className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line">Hand back to agent</button></form> : null}>
          {!d.agent ? <EmptyState icon="chat" title="No WhatsApp agent configured">Your agent appears here once it is set up.</EmptyState> : (
            <>
              {d.agent.kill_switch && <p className="mb-3 rounded-lg bg-danger-bg p-2 text-sm text-danger">The agent&apos;s kill switch is on. Messages are recorded but not answered automatically.</p>}
              <div className="flex min-h-80 flex-col gap-2 rounded-2xl bg-[#efe7dc] p-4 dark:bg-surface-2" aria-live="polite">
                {d.msgs.length === 0 && <p className="m-auto max-w-sm text-center text-sm text-muted">Type a message as a customer would. The agent answers only from the approved catalogue and FAQs, checks M-Pesa codes against reconciled payments, and passes anything else to your team.</p>}
                {d.msgs.map((m) => (
                  <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.direction === "in" ? "self-start bg-white text-graphite" : m.author === "human" ? "self-end bg-sand text-graphite" : m.author === "system" ? "self-center bg-transparent text-xs text-muted shadow-none" : "self-end bg-[#d9fdd3] text-graphite"}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-0.5 text-right text-[0.65rem] text-graphite/60">{m.author === "agent" ? `agent · ${String(m.meta?.intent ?? "")}` : m.author === "human" ? `team · ${String(m.meta?.staff ?? "")}` : ""} {m.created_at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })}</p>
                  </div>
                ))}
              </div>
              {d.conv?.meta?.pendingOrder && <p className="mt-2 text-xs text-muted">Pending order: {d.conv.meta.pendingOrder.qty} × {d.conv.meta.pendingOrder.sku}, KES {d.conv.meta.pendingOrder.total.toLocaleString("en-GB")} — awaiting M-Pesa code. In the demo, try code <span className="font-mono">TJL8R3N5YB</span> (KES 15,600 on the demo statement) with an order of 20 bags of cement; once used, the agent refuses to reuse it (from the reconciled statement).</p>}
              <form action={simulateCustomerMessage.bind(null, d.agent.id)} className="mt-3 flex gap-2">
                <input type="hidden" name="conversationId" value={d.conv?.id ?? ""} />
                <label htmlFor="msg" className="sr-only">Message as customer</label>
                <input id="msg" name="message" required maxLength={1000} autoComplete="off" placeholder="Message as a customer…" className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm" />
                <button className="rounded-full bg-[#1f7a54] px-4 py-2 text-sm font-semibold text-white">Send</button>
              </form>
              {!d.conv && <div className="mt-2 flex flex-wrap gap-1.5">{SUGGESTIONS.map((s) => <form key={s} action={simulateCustomerMessage.bind(null, d.agent.id)}><input type="hidden" name="message" value={s} /><button className="rounded-full bg-surface-2 px-3 py-1 text-xs ring-1 ring-line">{s}</button></form>)}</div>}
              {d.conv && (
                <form action={staffReply.bind(null, d.conv.id)} className="mt-4 border-t border-line pt-4">
                  <label htmlFor="staff" className="text-sm font-semibold">Take over and reply as your team</label>
                  <p className="text-xs text-muted">Replying pauses the agent on this conversation until you hand it back.</p>
                  <div className="mt-2 flex gap-2"><input id="staff" name="body" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm" placeholder="Your reply…" /><button className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Reply</button></div>
                </form>
              )}
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
