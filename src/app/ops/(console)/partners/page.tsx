import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { PageTitle, Panel, Table, Badge } from "@/components/app/AppShell";

export default async function Partners() {
  const u = await requireStaff();
  const rows = await asStaff(u, (tx) => tx<{ id: string; name: string; programme: string; status: string; contact_email: string | null; created_at: Date }[]>`select id, name, programme, status, contact_email, created_at from partners order by created_at desc`);
  return (
    <>
      <PageTitle title="Partners" description="Referral and white-label applications. White-label partners get a partner tenant with client sub-tenants (tenants.parent_tenant_id)." />
      <Panel>
        {rows.length === 0 ? <p className="text-sm text-muted">No partner applications yet.</p> : (
          <Table head={["Partner", "Programme", "Status", "Contact", "Applied"]}>{rows.map((p) => <tr key={p.id}><td className="px-3 py-2 font-medium">{p.name}</td><td className="px-3 py-2"><Badge tone="brand">{p.programme.replace("_", "-")}</Badge></td><td className="px-3 py-2">{p.status}</td><td className="px-3 py-2">{p.contact_email}</td><td className="px-3 py-2 text-muted">{relTime(p.created_at)}</td></tr>)}</Table>
        )}
      </Panel>
    </>
  );
}
