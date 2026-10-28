import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { PageTitle, Panel, Table, Badge } from "@/components/app/AppShell";
import { AddStaffForm } from "@/components/app/AddStaffForm";

const ROLE_DESC: Record<string, string> = { admin: "Everything, including prices, weights and team", content_editor: "Edit public content and sources", consultant: "Leads, pipeline, quotes, sessions", engineer: "Clients, runs, reviews, incidents", support: "Inbox, tickets, reviews" };

export default async function Team() {
  const u = await requireStaff();
  const staff = await asStaff(u, (tx) => tx<{ id: string; name: string; email: string; staff_role: string; mfa_enabled: boolean; last_login_at: Date | null }[]>`select * from ops_staff_directory()`);
  return (
    <>
      <PageTitle title="Team & permissions" description="Role-based access. Two-step verification is mandatory for every staff account." />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Staff">
          <Table head={["Name", "Role", "Two-step", "Last sign-in"]}>
            {staff.map((s) => <tr key={s.id}><td className="px-3 py-2"><p className="font-medium">{s.name}</p><p className="text-xs text-muted">{s.email}</p></td><td className="px-3 py-2"><Badge tone="brand">{s.staff_role}</Badge><p className="text-xs text-muted">{ROLE_DESC[s.staff_role]}</p></td><td className="px-3 py-2">{s.mfa_enabled ? <Badge tone="good">on</Badge> : <Badge tone="warn">pending</Badge>}</td><td className="px-3 py-2 text-muted">{s.last_login_at ? relTime(s.last_login_at) : "never"}</td></tr>)}
          </Table>
        </Panel>
        {u.staffRole === "admin" && <Panel title="Add a staff member"><AddStaffForm /></Panel>}
      </div>
    </>
  );
}
