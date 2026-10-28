import type { Metadata } from "next";
import Link from "next/link";
import { portal } from "@/lib/portal";
import { AppShell } from "@/components/app/AppShell";
import { logout } from "@/app/actions/auth";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: { default: "Client portal", template: "%s · Elans portal" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const c = await portal();
  const counts = await c.db(async (tx) => {
    const [r] = await tx<{ approvals: number; reviews: number; content: number; handoffs: number; tickets: number; kill: boolean }[]>`
      select (select count(*)::int from approvals where status = 'pending') as approvals,
             (select count(*)::int from review_items where status = 'open' and queue = 'client') as reviews,
             (select count(*)::int from studio_items where status = 'awaiting_client') as content,
             (select count(*)::int from conversations where status = 'handed_off') as handoffs,
             (select count(*)::int from tickets where status in ('open','pending')) as tickets,
             (select kill_switch from tenants where id = app_tenant()) as kill`;
    return r;
  });
  const nav = [
    { items: [{ href: "/portal", label: "Overview", icon: "chart", exact: true }] },
    {
      section: "Operations",
      items: [
        { href: "/portal/automations", label: "My Automations", icon: "bolt" },
        { href: "/portal/conversations", label: "Agents & Conversations", icon: "chat", badge: counts.handoffs },
        { href: "/portal/health", label: "Workflow Health", icon: "eye" },
        { href: "/portal/approvals", label: "Approvals", icon: "shield", badge: counts.approvals + counts.reviews + counts.content },
        { href: "/portal/campaigns", label: "Campaigns & Content", icon: "megaphone" },
      ],
    },
    {
      section: "Account",
      items: [
        { href: "/portal/projects", label: "Projects", icon: "route" },
        { href: "/portal/reports", label: "Reports", icon: "doc" },
        { href: "/portal/billing", label: "Usage & Billing", icon: "money" },
        { href: "/portal/support", label: "Support", icon: "inbox", badge: counts.tickets },
        { href: "/portal/documents", label: "Documents", icon: "layers" },
        { href: "/portal/integrations", label: "Integrations", icon: "flow" },
        { href: "/portal/team", label: "Team & Permissions", icon: "users" },
        { href: "/portal/privacy", label: "Data & Privacy", icon: "lock" },
        { href: "/portal/settings", label: "Settings", icon: "settings" },
      ],
    },
  ];
  const banner = (
    <>
      {c.isDemo && (
        <div role="note" className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-copper/60 bg-copper/10 px-4 py-2 text-sm text-copper-ink sm:px-6 lg:px-8">
          <span className="font-semibold">✦ Illustrative data. This is a demo workspace with synthetic invoices, payments and conversations.</span>
          <Link href="/assessment" className="font-semibold underline">Find your own opportunities →</Link>
        </div>
      )}
      {counts.kill && (
        <div role="alert" className="flex items-center gap-2 border-b border-danger/30 bg-danger-bg px-4 py-2 text-sm font-semibold text-danger sm:px-6 lg:px-8">
          <Icon name="power" size={16} /> Account-wide kill switch is ON. No automation will take any action until it is turned off in Data & Privacy.
        </div>
      )}
    </>
  );
  return (
    <AppShell area="portal" nav={nav} user={{ name: c.user.name, email: c.user.email, role: c.role }} tenantLabel={<><p className="text-xs uppercase tracking-wide text-muted">Workspace</p><p className="font-semibold text-heading">{c.tenantName}</p></>} banner={banner} signOut={logout.bind(null, "portal")}>
      {children}
    </AppShell>
  );
}
