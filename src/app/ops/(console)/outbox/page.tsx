import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { PageTitle, Panel, Table, Badge } from "@/components/app/AppShell";
import { Callout } from "@/components/ui/primitives";

export default async function Outbox() {
  const u = await requireStaff();
  const rows = await asStaff(u, (tx) => tx<{ id: string; channel: string; to_addr: string; subject: string | null; body: string; status: string; created_at: Date }[]>`select id, channel, to_addr, subject, body, status, created_at from outbox order by created_at desc limit 100`);
  return (
    <>
      <PageTitle title="Message log" description="Every email, WhatsApp and SMS Elans sends from the internal account is written here first." />
      {(process.env.EMAIL_PROVIDER ?? "log") === "log" && <Callout tone="info" className="mb-6">Delivery provider not configured: messages are logged here but not sent. Set EMAIL_PROVIDER to deliver.</Callout>}
      <Panel>
        <Table head={["When", "Channel", "To", "Message", "Status"]}>
          {rows.map((m) => <tr key={m.id}><td className="whitespace-nowrap px-3 py-2 text-muted">{relTime(m.created_at)}</td><td className="px-3 py-2">{m.channel}</td><td className="px-3 py-2 text-xs">{m.to_addr}</td><td className="max-w-lg px-3 py-2"><p className="font-medium">{m.subject}</p><p className="line-clamp-2 whitespace-pre-line text-xs text-muted">{m.body}</p></td><td className="px-3 py-2"><Badge tone={m.status === "sent" ? "good" : m.status === "failed" ? "bad" : "neutral"}>{m.status}</Badge></td></tr>)}
        </Table>
      </Panel>
    </>
  );
}
