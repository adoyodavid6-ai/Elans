import { portal } from "@/lib/portal";
import { payInvoice } from "@/app/portal/actions";
import { Badge, Kpi, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { formatMoney, formatNumber } from "@/lib/core/money";

const METER_FOR: Record<string, string> = { document_pages: "doc_page", wa_conversations: "wa_conversation", transactions: "txn_reconciled", etims_checks: "etims_check" };

export default async function Billing() {
  const c = await portal();
  const d = await c.db(async (tx) => ({
    sub: (await tx<{ package_key: string; status: string; monthly_amount: number; currency: string; allowances: Record<string, number>; started_at: string }[]>`select package_key, status, monthly_amount, currency, allowances, started_at::text from subscriptions where status = 'active' limit 1`)[0],
    usage: await tx<{ meter: string; q: number; cost: number }[]>`select meter, sum(quantity)::float as q, sum(cost)::float as cost from usage_events where created_at > date_trunc('month', now()) group by meter order by meter`,
    invoices: await tx<{ id: string; number: string; status: string; amount: number; currency: string; issued_at: string; due_date: string; paid_at: Date | null; lines: { description?: string; amount?: number }[] }[]>`select id, number, status, amount, currency, issued_at::text, due_date::text, paid_at, lines from invoices order by issued_at desc`,
  }));
  const due = d.invoices.filter((i) => i.status === "issued" || i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);
  return (
    <>
      <PageTitle title="Usage & Billing" description="Your package, what you have used this month against allowances, and your invoices. Pay by M-Pesa from here." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Kpi label="Package" value={d.sub ? d.sub.package_key.replace(/^\w/, (x) => x.toUpperCase()) : "None"} hint={d.sub ? `since ${d.sub.started_at}` : undefined} />
        <Kpi label="Monthly retainer" value={d.sub ? formatMoney(Number(d.sub.monthly_amount)) : "—"} />
        <Kpi label="Balance due" value={formatMoney(due)} tone={due > 0 ? "warn" : "good"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Usage this month">
          <ul className="space-y-4 text-sm">
            {Object.entries(d.sub?.allowances ?? {}).map(([k, allowance]) => {
              const used = d.usage.find((u) => u.meter === (METER_FOR[k] ?? k))?.q ?? 0;
              const pct = allowance ? used / allowance : 0;
              return (
                <li key={k}>
                  <div className="flex justify-between"><span className="capitalize">{k.replace(/_/g, " ")}</span><span>{formatNumber(used)} of {formatNumber(allowance)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-surface-2"><div className={`h-full rounded-full ${pct > 1 ? "bg-danger" : pct > 0.8 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
                  {pct > 0.8 && <p className="mt-1 text-xs text-warning">{pct > 1 ? "Over allowance: overage is billed at the agreed per-unit rate." : "Approaching your allowance."}</p>}
                </li>
              );
            })}
          </ul>
          <h3 className="mt-6 text-sm font-semibold">All meters</h3>
          <Table head={["Meter", "Quantity", "Model cost (USD)"]} empty="No usage yet">{d.usage.map((u) => <tr key={u.meter}><td className="px-3 py-2">{u.meter.replace(/_/g, " ")}</td><td className="px-3 py-2">{formatNumber(u.q)}</td><td className="px-3 py-2">{Number(u.cost).toFixed(4)}</td></tr>)}</Table>
        </Panel>
        <Panel title="Invoices">
          <Table head={["Invoice", "Amount", "Due", "Status", ""]} empty="No invoices yet">
            {d.invoices.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="px-3 py-2"><p className="font-medium">{i.number}</p><p className="text-xs text-muted">{i.lines.filter((l) => l.description).map((l) => l.description).join(", ")}</p></td>
                <td className="px-3 py-2 whitespace-nowrap">{formatMoney(Number(i.amount), i.currency)}</td>
                <td className="px-3 py-2 text-xs">{i.due_date}</td>
                <td className="px-3 py-2"><Badge tone={i.status === "paid" ? "good" : i.status === "overdue" ? "bad" : "warn"}>{i.status}</Badge></td>
                <td className="px-3 py-2">
                  {i.status !== "paid" && i.status !== "void" && (
                    <form action={payInvoice.bind(null, i.id)} className="flex gap-1">
                      <label htmlFor={`p-${i.id}`} className="sr-only">M-Pesa phone number</label>
                      <input id={`p-${i.id}`} name="phone" inputMode="tel" required placeholder="07XX XXX XXX" className="w-32 rounded-lg border border-line bg-surface px-2 py-1 text-xs" />
                      <button className="rounded-lg bg-[#1f7a54] px-3 py-1 text-xs font-semibold text-white">Pay</button>
                    </form>
                  )}
                  {i.paid_at && <p className="text-xs text-muted">paid {i.paid_at.toLocaleDateString("en-GB")}</p>}
                </td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-muted">M-Pesa runs in test mode until live Daraja credentials are configured: a test payment completes immediately and no money moves.</p>
        </Panel>
      </div>
    </>
  );
}
