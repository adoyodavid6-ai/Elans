import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";

export default async function Operations() {
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => ({
    reviews: await tx<{ id: string; tenant_id: string; tenant_name: string; kind: string; title: string; sla_due_at: Date }[]>`select * from ops_review_queue()`,
    tickets: await tx<{ id: string; tenant_id: string; tenant_name: string; subject: string; priority: string; status: string; sla_due_at: Date | null; created_at: Date }[]>`select * from ops_ticket_queue()`,
    incidents: await tx<{ id: string; tenant_id: string; tenant_name: string; severity: string; title: string; status: string; opened_at: Date }[]>`select * from ops_incident_queue()`,
  }));
  return (
    <>
      <PageTitle title="Reviews, support & incidents" description="Cross-client queues show metadata only. Open a client (with an audited access grant) to work an item." />
      <div className="space-y-6">
        <Panel title={`Elans review centre (${d.reviews.length})`}>
          <Table head={["Client", "Item", "Kind", "SLA"]}>
            {d.reviews.map((r) => <tr key={r.id}><td className="px-3 py-2"><Link href={`/ops/clients/${r.tenant_id}`} className="font-medium hover:underline">{r.tenant_name}</Link></td><td className="px-3 py-2">{r.title}</td><td className="px-3 py-2 text-xs">{r.kind}</td><td className="px-3 py-2"><Badge tone={r.sla_due_at < new Date() ? "bad" : "neutral"}>{relTime(r.sla_due_at)}</Badge></td></tr>)}
          </Table>
        </Panel>
        <Panel title={`Support tickets (${d.tickets.length})`}>
          <Table head={["Client", "Subject", "Priority", "Status", "Opened"]}>
            {d.tickets.map((t) => <tr key={t.id}><td className="px-3 py-2"><Link href={`/ops/clients/${t.tenant_id}`} className="font-medium hover:underline">{t.tenant_name}</Link></td><td className="px-3 py-2">{t.subject}</td><td className="px-3 py-2"><Badge tone={t.priority === "urgent" ? "bad" : t.priority === "high" ? "warn" : "neutral"}>{t.priority}</Badge></td><td className="px-3 py-2">{t.status}</td><td className="px-3 py-2 text-muted">{relTime(t.created_at)}</td></tr>)}
          </Table>
        </Panel>
        <Panel title={`Open incidents (${d.incidents.length})`}>
          <Table head={["Client", "Severity", "Incident", "Status", "Opened"]}>
            {d.incidents.map((i) => <tr key={i.id}><td className="px-3 py-2"><Link href={`/ops/clients/${i.tenant_id}`} className="font-medium hover:underline">{i.tenant_name}</Link></td><td className="px-3 py-2"><Badge tone="bad">{i.severity}</Badge></td><td className="px-3 py-2">{i.title}</td><td className="px-3 py-2">{i.status}</td><td className="px-3 py-2 text-muted">{relTime(i.opened_at)}</td></tr>)}
          </Table>
          <p className="mt-3 text-xs text-muted">Incidents are worked during support hours (set in Site settings); sev1/sev2 page the on-call engineer.</p>
        </Panel>
      </div>
    </>
  );
}
