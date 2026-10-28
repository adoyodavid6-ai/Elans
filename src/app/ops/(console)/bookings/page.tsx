import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { setBookingStatus } from "@/app/ops/actions";
import { formatMoney } from "@/lib/core/money";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";

export default async function Bookings() {
  const u = await requireStaff();
  const rows = await asStaff(u, (tx) => tx<{ id: string; type: string; starts_at: Date; status: string; topic: string | null; name: string; email: string; organisation: string; pay: string | null; amount: number | null; receipt: string | null }[]>`
    select b.id, b.type, b.starts_at, b.status, b.topic, c.name, c.email, c.organisation, p.status as pay, p.amount, p.provider_ref as receipt
    from bookings b join contacts c on c.id = b.contact_id left join payments p on p.id = b.payment_id order by b.starts_at desc limit 200`);
  return (
    <>
      <PageTitle title="Sessions" description="Strategy Sessions and Discovery Calls booked from the website. Times in EAT." />
      <Panel>
        <Table head={["When", "Type", "Client", "Topic", "Payment", "Status", "Actions"]}>
          {rows.map((b) => (
            <tr key={b.id}>
              <td className="whitespace-nowrap px-3 py-2.5">{b.starts_at.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })}</td>
              <td className="px-3 py-2.5 capitalize">{b.type}</td>
              <td className="px-3 py-2.5"><p className="font-medium">{b.organisation}</p><p className="text-xs text-muted">{b.name} · {b.email}</p></td>
              <td className="max-w-xs px-3 py-2.5 text-xs text-muted">{b.topic}</td>
              <td className="px-3 py-2.5">{b.pay ? <><Badge tone={b.pay === "succeeded" ? "good" : b.pay === "failed" ? "bad" : "warn"}>{b.pay}</Badge><p className="text-xs text-muted">{b.amount ? formatMoney(b.amount) : ""} {b.receipt}</p></> : <span className="text-xs text-muted">free / invoice</span>}</td>
              <td className="px-3 py-2.5"><Badge tone={b.status === "confirmed" ? "good" : b.status === "completed" ? "info" : b.status === "pending_payment" ? "warn" : "neutral"}>{b.status.replace("_", " ")}</Badge></td>
              <td className="px-3 py-2.5">
                <div className="flex gap-1">
                  {(["completed", "no_show", "cancelled"] as const).map((s) => (
                    <form key={s} action={setBookingStatus.bind(null, b.id, s)}><button className="rounded-md bg-surface-2 px-2 py-1 text-xs ring-1 ring-line">{s.replace("_", "-")}</button></form>
                  ))}
                  {b.status === "pending_payment" && <form action={setBookingStatus.bind(null, b.id, "confirmed")}><button className="rounded-md bg-success px-2 py-1 text-xs text-white">mark paid</button></form>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
