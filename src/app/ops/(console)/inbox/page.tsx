import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { supportHoursOpen } from "@/lib/engines/conversation";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";

export default async function Inbox() {
  const u = await requireStaff();
  const rows = await asStaff(u, (tx) => tx<{ id: string; status: string; resolution: string | null; language: string; updated_at: Date; last: string | null; count: number; callback: boolean | null; first_page: string | null }[]>`
    select c.id, c.status, c.resolution, c.language, c.updated_at, c.meta->>'firstPage' as first_page,
      (select body from messages m where m.conversation_id = c.id order by created_at desc limit 1) as last,
      (select count(*)::int from messages m where m.conversation_id = c.id) as count,
      (select bool_or(callback_requested) from handoffs h where h.conversation_id = c.id) as callback
    from conversations c where c.channel = 'web' order by (c.status = 'handed_off') desc, c.updated_at desc limit 100`);
  return (
    <>
      <PageTitle title="Live chat inbox" description={`Website conversations with the Elans agent. Handovers wait here. Support hours are currently ${supportHoursOpen() ? "OPEN" : "CLOSED (callbacks are booked instead)"}.`} />
      <Panel>
        <Table head={["Conversation", "Status", "Language", "Messages", "Started on", "Updated"]}>
          {rows.map((c) => (
            <tr key={c.id} className={c.status === "handed_off" ? "bg-warning-bg/40" : "hover:bg-surface-2"}>
              <td className="max-w-md px-3 py-2.5"><Link href={`/ops/inbox/${c.id}`} className="font-medium hover:underline">{c.last?.slice(0, 90) ?? "(empty)"}</Link></td>
              <td className="px-3 py-2.5">{c.status === "handed_off" ? <Badge tone="warn">{c.callback ? "callback requested" : "waiting for a person"}</Badge> : c.status === "closed" ? <Badge>{c.resolution ?? "closed"}</Badge> : <Badge tone="info">agent</Badge>}</td>
              <td className="px-3 py-2.5 uppercase">{c.language}</td>
              <td className="px-3 py-2.5">{c.count}</td>
              <td className="px-3 py-2.5 text-xs text-muted">{c.first_page}</td>
              <td className="px-3 py-2.5 text-muted">{relTime(c.updated_at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
