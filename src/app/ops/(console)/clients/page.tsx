import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { formatMoney } from "@/lib/core/money";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";

export default async function Clients() {
  const u = await requireStaff();
  const rows = await asStaff(u, (tx) => tx<{ tenant_id: string; tenant_name: string; kind: string; active_instances: number; runs_7d: number; failed_7d: number; open_reviews: number; pending_approvals: number; open_incidents: number; mrr: number }[]>`select * from ops_portfolio_metrics() order by kind, tenant_name`);
  return (
    <>
      <PageTitle title="Clients" description="Portfolio metrics contain no personal data. Opening a client requires a stated reason and creates a 4-hour, audited access grant." />
      <Panel>
        <Table head={["Client", "Type", "Automations", "Runs (7d)", "Failed", "Open reviews", "Approvals", "Incidents", "MRR"]}>
          {rows.map((r) => (
            <tr key={r.tenant_id} className="hover:bg-surface-2">
              <td className="px-3 py-2.5"><Link href={`/ops/clients/${r.tenant_id}`} className="font-medium hover:underline">{r.tenant_name}</Link></td>
              <td className="px-3 py-2.5"><Badge tone={r.kind === "demo" ? "neutral" : "brand"}>{r.kind}</Badge></td>
              <td className="px-3 py-2.5">{r.active_instances}</td>
              <td className="px-3 py-2.5">{r.runs_7d}</td>
              <td className="px-3 py-2.5">{Number(r.failed_7d) ? <Badge tone="bad">{r.failed_7d}</Badge> : 0}</td>
              <td className="px-3 py-2.5">{r.open_reviews}</td>
              <td className="px-3 py-2.5">{r.pending_approvals}</td>
              <td className="px-3 py-2.5">{Number(r.open_incidents) ? <Badge tone="bad">{r.open_incidents}</Badge> : 0}</td>
              <td className="px-3 py-2.5">{formatMoney(Number(r.mrr))}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
