import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { AppShell } from "@/components/app/AppShell";
import { navCounts } from "@/lib/ops/data";
import { logout } from "@/app/actions/auth";

export const metadata: Metadata = { title: { default: "Console", template: "%s · Elans console" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const u = await requireStaff();
  const c = await navCounts(u);
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
      section: "Delivery",
      items: [
        { href: "/ops/clients", label: "Clients", icon: "building" },
        { href: "/ops/operations", label: "Reviews, support & incidents", icon: "shield", badge: c.reviews + c.tickets + c.incidents },
        { href: "/ops/templates", label: "Templates & evals", icon: "layers" },
        { href: "/ops/partners", label: "Partners", icon: "globe" },
      ],
    },
    {
      section: "Content & settings",
      items: [
        { href: "/ops/content", label: "Content CMS", icon: "doc" },
        { href: "/ops/content/prices", label: "Prices", icon: "money" },
        { href: "/ops/content/weights", label: "Scoring weights", icon: "target" },
        { href: "/ops/content/sources", label: "Sources", icon: "info" },
        { href: "/ops/settings", label: "Site settings", icon: "settings" },
        { href: "/ops/team", label: "Team", icon: "user" },
        { href: "/ops/analytics", label: "Analytics", icon: "chart" },
        { href: "/ops/outbox", label: "Message log", icon: "send" },
      ],
    },
  ];
  return (
    <AppShell area="ops" nav={nav} user={{ name: u.name, email: u.email, role: u.staffRole ?? "" }} signOut={logout.bind(null, "ops")}>
      {children}
    </AppShell>
  );
}
