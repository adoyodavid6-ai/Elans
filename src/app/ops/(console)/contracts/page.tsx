import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { formatMoney } from "@/lib/core/money";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";

export default async function Contracts() {
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => ({
    quotes: await tx<{ id: string; number: string; status: string; totals: { contractValue?: number; grossMargin?: number }; created_at: Date; opp: string }[]>`select q.id, q.number, q.status, q.totals, q.created_at, o.name as opp from quotes q join opportunities o on o.id = q.opportunity_id order by q.created_at desc`,
    contracts: await tx<{ id: string; signed_by: string; signed_at: Date; min_term_months: number; start_date: Date; client_tenant_id: string; number: string }[]>`select c.id, c.signed_by, c.signed_at, c.min_term_months, c.start_date, c.client_tenant_id, q.number from contracts c join quotes q on q.id = c.quote_id order by c.signed_at desc`,
  }));
  return (
    <>
      <PageTitle title="Quotes & contracts" />
      <div className="space-y-6">
        <Panel title="Contracts">
          {d.contracts.length === 0 ? <p className="text-sm text-muted">No signed contracts yet. A contract is created when a client accepts a proposal.</p> : (
            <Table head={["Quote", "Signed by", "Signed", "Start", "Min term", "Client"]}>
              {d.contracts.map((c) => <tr key={c.id}><td className="px-3 py-2">{c.number}</td><td className="px-3 py-2">{c.signed_by}</td><td className="px-3 py-2">{relTime(c.signed_at)}</td><td className="px-3 py-2">{new Date(c.start_date).toLocaleDateString("en-GB")}</td><td className="px-3 py-2">{c.min_term_months} months</td><td className="px-3 py-2"><Link href={`/ops/clients/${c.client_tenant_id}`} className="text-copper-ink hover:underline">Open client</Link></td></tr>)}
            </Table>
          )}
        </Panel>
        <Panel title="Quotes">
          <Table head={["Quote", "Opportunity", "Status", "Contract value", "Margin", "Created"]}>
            {d.quotes.map((q) => <tr key={q.id}><td className="px-3 py-2"><Link href={`/ops/quotes/${q.id}`} className="font-medium hover:underline">{q.number}</Link></td><td className="px-3 py-2">{q.opp}</td><td className="px-3 py-2"><Badge tone={q.status === "accepted" ? "good" : q.status === "sent" ? "info" : "neutral"}>{q.status}</Badge></td><td className="px-3 py-2">{q.totals?.contractValue ? formatMoney(q.totals.contractValue) : "—"}</td><td className="px-3 py-2">{q.totals?.grossMargin !== undefined ? `${(q.totals.grossMargin * 100).toFixed(0)}%` : "—"}</td><td className="px-3 py-2 text-muted">{relTime(q.created_at)}</td></tr>)}
          </Table>
        </Panel>
      </div>
    </>
  );
}
