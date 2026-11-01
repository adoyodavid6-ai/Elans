import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { AppShell } from "@/components/app/AppShell";
import type { PaletteAction } from "@/components/app/CommandPalette";
import { navCounts } from "@/lib/ops/data";
import { logout } from "@/app/actions/auth";

export const metadata: Metadata = { title: { default: "Console", template: "%s · Elans console" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const u = await requireStaff();
  const c = await navCounts(u);
  const role = u.staffRole ?? "";
  const is = (...roles: string[]) => roles.includes(role);
  const nav = [
    { items: [{ href: "/ops", label: "Dashboard", icon: "chart", exact: true }] },
    {
      section: "Sales",
      items: [
        { href: "/ops/leads", label: "Leads & CRM", icon: "users", badge: c.leads },
        { href: "/ops/pipeline", label: "Pipeline", icon: "route" },
        { href: "/ops/assessments", label: "Assessments", icon: "spark", badge: c.assessments },
        { href: "/ops/bookings", label: "Sessions", icon: "calendar", badge: c.bookings },
        { href: "/ops/inbox", label: "Live chat inbox", icon: "chat", badge: c.handoffs },
        { href: "/ops/contracts", label: "Quotes & contracts", icon: "doc" },
      ],
    },
    {
      section: "Clients",
      items: [
        { href: "/ops/clients", label: "Clients", icon: "building" },
        { href: "/ops/operations", label: "Reviews, support & incidents", icon: "shield", badge: c.reviews + c.tickets + c.incidents },
        ...(is("admin", "consultant", "engineer", "support") ? [{ href: "/ops/billing", label: "Billing", icon: "money" }] : []),
        { href: "/ops/partners", label: "Partners", icon: "globe" },
        { href: "/ops/templates", label: "Templates & evals", icon: "layers" },
      ],
    },
    {
      section: "Website",
      items: [
        { href: "/ops/content", label: "Content CMS", icon: "doc" },
        ...(is("admin") ? [{ href: "/ops/content/prices", label: "Prices", icon: "money" }, { href: "/ops/content/weights", label: "Scoring weights", icon: "target" }] : []),
        { href: "/ops/content/sources", label: "Sources", icon: "info" },
        { href: "/ops/analytics", label: "Analytics", icon: "chart" },
      ],
    },
    {
      section: "Admin",
      items: [
        ...(is("admin") ? [{ href: "/ops/settings", label: "Site settings", icon: "settings" }] : []),
        { href: "/ops/team", label: "Team", icon: "user" },
        ...(is("admin") ? [{ href: "/ops/audit", label: "Audit log", icon: "lock" }] : []),
        { href: "/ops/outbox", label: "Message log", icon: "send" },
        { href: "/ops/help", label: "Help & guides", icon: "info" },
      ],
    },
  ];
  const commands: PaletteAction[] = [
    ...(is("admin", "consultant", "support") ? [{ group: "Actions", label: "Add a lead", href: "/ops/leads/new", keywords: "new create contact enquiry" }] : []),
    ...(is("admin", "consultant") ? [
      { group: "Actions", label: "New client", href: "/ops/clients/new", keywords: "create tenant workspace onboard" },
      { group: "Actions", label: "Issue an invoice", href: "/ops/billing#new", keywords: "bill charge payment" },
      { group: "Actions", label: "Export leads (CSV)", href: "/ops/leads-export", keywords: "download spreadsheet" },
    ] : []),
    { group: "Actions", label: "Leads due a follow-up", href: "/ops", keywords: "today tasks reminders" },
    ...nav.flatMap((s) => s.items.map((i) => ({ group: "Pages", label: i.label, href: i.href }))),
  ];
  return (
    <AppShell area="ops" nav={nav} commands={commands} user={{ name: u.name, email: u.email, role }} signOut={logout.bind(null, "ops")}>
      {children}
    </AppShell>
  );
}
