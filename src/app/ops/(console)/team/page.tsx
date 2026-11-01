import { isSuper, requireStaff } from "@/lib/auth";
import { AskSuper } from "@/components/app/AskSuper";
import { asStaff, relTime } from "@/lib/ops/data";
import { PageTitle, Panel, Table, Badge } from "@/components/app/AppShell";
import { AddStaffForm } from "@/components/app/AddStaffForm";

const ROLE_DESC: Record<string, string> = { super_admin: "Full access: read, edit, approve and configure everything", admin: "Read and contribute; bigger changes go to the Super Admin" };
const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", admin: "Admin" };

export default async function Team() {
  const u = await requireStaff();
  const staff = await asStaff(u, (tx) => tx<{ id: string; name: string; email: string; staff_role: string; mfa_enabled: boolean; last_login_at: Date | null }[]>`select * from ops_staff_directory()`);
  return (
    <>
      <PageTitle title="Team & permissions" description="Two access levels: Super Admin and Admin. Two-step verification is mandatory for every staff account." />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Staff">
          <Table head={["Name", "Role", "Two-step", "Last sign-in"]}>
            {staff.map((s) => <tr key={s.id}><td className="px-3 py-2"><p className="font-medium">{s.name}</p><p className="text-xs text-muted">{s.email}</p></td><td className="px-3 py-2"><Badge tone={s.staff_role === "super_admin" ? "brand" : "info"}>{ROLE_LABEL[s.staff_role] ?? s.staff_role}</Badge><p className="text-xs text-muted">{ROLE_DESC[s.staff_role]}</p></td><td className="px-3 py-2">{s.mfa_enabled ? <Badge tone="good">on</Badge> : <Badge tone="warn">pending</Badge>}</td><td className="px-3 py-2 text-muted">{s.last_login_at ? relTime(s.last_login_at) : "never"}</td></tr>)}
          </Table>
        </Panel>
        {isSuper(u) ? <Panel title="Add a staff member"><AddStaffForm /></Panel> : <Panel title="Need someone added?"><p className="mb-3 text-sm text-muted">Only the Super Admin adds or removes staff.</p><AskSuper kind="team.add" title="Add a staff member" link="/ops/team" label="Ask Super Admin" /></Panel>}
      </div>
    </>
  );
}
