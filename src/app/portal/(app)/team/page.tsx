import { portal } from "@/lib/portal";
import { canAdmin } from "@/lib/auth";
import { inviteMember } from "@/app/portal/actions";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";

const ROLES = [
  ["owner", "Everything, including the account kill switch and billing"],
  ["admin", "Manage team, autonomy settings and integrations"],
  ["approver", "Approve actions, confirm payments, sign off content, use kill switches"],
  ["member", "Use automations, raise tickets, upload documents"],
  ["viewer", "Read-only access to dashboards and reports"],
];

export default async function Team() {
  const c = await portal();
  const d = await c.db(async (tx) => ({
    members: await tx<{ user_id: string; name: string; email: string; role: string; mfa_enabled: boolean; last_login_at: Date | null }[]>`select * from tenant_members()`,
    invites: await tx<{ email: string; role: string; expires_at: Date; accepted_at: Date | null }[]>`select email, role, expires_at, accepted_at from invites where accepted_at is null and expires_at > now() order by created_at desc`,
  }));
  const admin = canAdmin(c.role) && !c.isDemo;
  return (
    <>
      <PageTitle title="Team & Permissions" description="Who can see and decide what. Owners and admins must use two-factor authentication." />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Members">
            <Table head={["Name", "Role", "Two-factor", "Last sign-in"]}>
              {d.members.map((m) => (
                <tr key={m.user_id}><td className="px-3 py-2"><p className="font-medium">{m.name}</p><p className="text-xs text-muted">{m.email}</p></td><td className="px-3 py-2"><Badge tone="brand">{m.role}</Badge></td><td className="px-3 py-2">{m.mfa_enabled ? <Badge tone="good">on</Badge> : <Badge tone={["owner", "admin"].includes(m.role) ? "bad" : "neutral"}>off</Badge>}</td><td className="px-3 py-2 text-xs text-muted">{m.last_login_at ? relTime(m.last_login_at) : "never"}</td></tr>
              ))}
            </Table>
          </Panel>
          {d.invites.length > 0 && <Panel title="Pending invitations"><ul className="space-y-1 text-sm">{d.invites.map((i) => <li key={i.email} className="flex justify-between"><span>{i.email} · {i.role}</span><span className="text-xs text-muted">expires {relTime(i.expires_at)}</span></li>)}</ul></Panel>}
          <Panel title="What each role can do"><dl className="space-y-2 text-sm">{ROLES.map(([r, t]) => <div key={r} className="flex gap-3"><dt className="w-20 shrink-0 font-semibold capitalize">{r}</dt><dd className="text-muted">{t}</dd></div>)}</dl></Panel>
        </div>
        <Panel title="Invite someone">
          {admin ? (
            <form action={inviteMember} className="space-y-3">
              <div><label htmlFor="email" className="text-sm font-medium">Email</label><input id="email" name="email" type="email" required className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></div>
              <div><label htmlFor="role" className="text-sm font-medium">Role</label><select id="role" name="role" defaultValue="member" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">{ROLES.filter(([r]) => r !== "owner").map(([r]) => <option key={r} value={r}>{r}</option>)}</select></div>
              <button className="w-full rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Send invitation</button>
              <p className="text-xs text-muted">Invitations expire after 14 days.</p>
            </form>
          ) : <p className="text-sm text-muted">{c.isDemo ? "Invitations are disabled in the demo." : "Only owners and admins can invite people."}</p>}
        </Panel>
      </div>
    </>
  );
}
