import type { Metadata } from "next";
import { isSuper, requireStaff } from "@/lib/auth";
import { AppShell } from "@/components/app/AppShell";
import type { PaletteAction } from "@/components/app/CommandPalette";
import { asStaff, navCounts } from "@/lib/ops/data";
import { logout } from "@/app/actions/auth";
import { after } from "next/server";
import Link from "next/link";
import { REMINDER_MINUTES, sendDueReminders } from "@/lib/reminders";
import { deliverOutbox } from "@/lib/outbox";

// Backup for the scheduled job: while anyone is using the console, due reminders and queued messages go out
// at most once a minute even if the external scheduler is not set up yet.
let lastTick = 0;
function tick() {
  if (Date.now() - lastTick < 60_000) return;
  lastTick = Date.now();
  after(async () => {
    try { await sendDueReminders(); await deliverOutbox(20); } catch (e) { console.error("[console tick]", (e as Error).message); }
  });
}

export const metadata: Metadata = { title: { default: "Console", template: "%s · Elans console" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const u = await requireStaff();
  const c = await navCounts(u);
  const sup = isSuper(u);
  const role = sup ? "Super Admin" : "Admin";
  tick();
  const soon = await asStaff(u, (tx) => tx<{ starts_at: Date; who: string | null; type: string }[]>`
    select b.starts_at, coalesce(c.organisation, c.name) as who, b.type from bookings b left join contacts c on c.id = b.contact_id
    where b.status = 'confirmed' and b.starts_at between now() and now() + make_interval(mins => ${REMINDER_MINUTES}) order by b.starts_at limit 3`).catch(() => []);
  const requests = await asStaff(u, async (tx) => Number((await tx<{ n: string }[]>`select count(*) n from staff_requests where status = 'pending' and (${sup} or requested_by = ${u.id})`)[0]?.n ?? 0)).catch(() => 0);
  const nav = [
    { items: [{ href: "/ops", label: "Dashboard", icon: "chart", exact: true }] },
    {
      section: "Sales",
      items: [
        { href: "/ops/leads", label: "Leads & CRM", icon: "users", badge: c.leads },
        { href: "/ops/pipeline", label: "Pipeline", icon: "route" },
        { href: "/ops/assessments", label: "Assessments", icon: "spark", badge: c.assessments },
        { href: "/ops/bookings", label: "Sessions calendar", icon: "calendar", badge: c.bookings },
        { href: "/ops/inbox", label: "Live chat inbox", icon: "chat", badge: c.handoffs },
        { href: "/ops/contracts", label: "Quotes & contracts", icon: "doc" },
        { href: "/ops/documents", label: "Documents & templates", icon: "layers" },
      ],
    },
    {
      section: "Clients",
      items: [
        { href: "/ops/clients", label: "Clients", icon: "building" },
        { href: "/ops/operations", label: "Reviews, support & incidents", icon: "shield", badge: c.reviews + c.tickets + c.incidents },
        { href: "/ops/billing", label: "Billing", icon: "money" },
        ...(sup ? [{ href: "/ops/payments", label: "Payments (M-Pesa, Paystack)", icon: "money" }] : []),
        { href: "/ops/partners", label: "Partners", icon: "globe" },
        { href: "/ops/templates", label: "Templates & evals", icon: "layers" },
      ],
    },
    {
      section: "Website",
      items: [
        { href: "/ops/content", label: "Content CMS", icon: "doc" },
        ...(sup ? [{ href: "/ops/content/prices", label: "Prices", icon: "money" }, { href: "/ops/content/weights", label: "Scoring weights", icon: "target" }] : []),
        { href: "/ops/content/sources", label: "Sources", icon: "info" },
        { href: "/ops/analytics", label: "Analytics", icon: "chart" },
      ],
    },
    {
      section: "Admin",
      items: [
        ...(sup ? [{ href: "/ops/settings", label: "Site settings", icon: "settings" }] : []),
        { href: "/ops/requests", label: sup ? "Requests to approve" : "My requests", icon: "send", badge: requests },
        { href: "/ops/team", label: "Team", icon: "user" },
        ...(sup ? [{ href: "/ops/audit", label: "Audit log", icon: "lock" }] : []),
        { href: "/ops/outbox", label: "Message log", icon: "send" },
        { href: "/ops/help", label: "Help & guides", icon: "info" },
      ],
    },
  ];
  const commands: PaletteAction[] = [
    { group: "Actions", label: "Add a lead", href: "/ops/leads/new", keywords: "new create contact enquiry" },
    { group: "Actions", label: "Issue an invoice", href: "/ops/billing#new", keywords: "bill charge payment" },
    { group: "Actions", label: "New quotation document", href: "/ops/documents/new?kind=quotation", keywords: "quote price proposal pdf" },
    { group: "Actions", label: "New contract", href: "/ops/documents/new?kind=contract", keywords: "agreement sign pdf" },
    { group: "Actions", label: "New receipt", href: "/ops/documents/new?kind=receipt", keywords: "payment received pdf" },
    ...(sup ? [
      { group: "Actions", label: "New client", href: "/ops/clients/new", keywords: "create tenant workspace onboard" },
      { group: "Actions", label: "Export leads (CSV)", href: "/ops/leads-export", keywords: "download spreadsheet" },
      { group: "Actions", label: "Payment settings (M-Pesa, Paystack)", href: "/ops/payments", keywords: "mpesa daraja paystack card keys webhook" },
      { group: "Actions", label: "Edit document templates", href: "/ops/documents/templates", keywords: "design branding layout quotation contract receipt" },
    ] : []),
    { group: "Actions", label: sup ? "Requests to approve" : "Ask the Super Admin / my requests", href: "/ops/requests", keywords: "approve escalate super admin permission" },
    { group: "Actions", label: "Leads due a follow-up", href: "/ops", keywords: "today tasks reminders" },
    ...nav.flatMap((s) => s.items.map((i) => ({ group: "Pages", label: i.label, href: i.href }))),
  ];
  return (
    <AppShell area="ops" nav={nav} commands={commands} user={{ name: u.name, email: u.email, role }} signOut={logout.bind(null, "ops")}>
      {soon.length > 0 && (
        <p role="status" className="mb-4 flex flex-wrap items-center gap-x-2 rounded-xl border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
          <span className="font-semibold">Starting soon:</span>
          {soon.map((s, i) => <span key={i}>{s.who ?? "client"} at {s.starts_at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })} ({Math.max(1, Math.round((s.starts_at.getTime() - Date.now()) / 60000))} min){i < soon.length - 1 ? "," : ""}</span>)}
          <Link href="/ops/bookings" className="ml-auto font-semibold underline">Open calendar</Link>
        </p>
      )}
      {children}
    </AppShell>
  );
}
