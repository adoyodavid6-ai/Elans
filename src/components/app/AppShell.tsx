import Link from "next/link";
import { Children, type ReactNode } from "react";
import { cookies } from "next/headers";
import { TreeMark } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "./ThemeToggle";
import { NavLinks, type NavItem } from "./NavLinks";
import { MobileNav } from "./MobileNav";

export async function AppShell({ area, nav, user, tenantLabel, banner, children, signOut }: { area: "ops" | "portal"; nav: { section?: string; items: NavItem[] }[]; user: { name: string; email: string; role: string }; tenantLabel?: ReactNode; banner?: ReactNode; children: ReactNode; signOut: () => Promise<void> }) {
  const theme = (await cookies()).get("elans_theme")?.value;
  return (
    <div data-theme={theme === "dark" ? "dark" : undefined} className="min-h-dvh bg-bg text-text">
      <a href="#app-main" className="skip-link">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <TreeMark size={30} />
          <div>
            <p className="font-display text-lg font-bold leading-none text-heading">Elans</p>
            <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted">{area === "ops" ? "Console" : "Client portal"}</p>
          </div>
        </div>
        {tenantLabel && <div className="border-b border-line px-5 py-3 text-sm">{tenantLabel}</div>}
        <nav aria-label={area === "ops" ? "Console" : "Portal"} className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks nav={nav} />
        </nav>
        <div className="border-t border-line p-4">
          <p className="truncate text-sm font-semibold text-heading">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email} · {user.role}</p>
          <div className="mt-3 flex items-center justify-between">
            <ThemeToggle current={theme === "dark" ? "dark" : "light"} />
            <form action={signOut}>
              <button className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-heading">
                <Icon name="logout" size={16} /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
          <MobileNav nav={nav} area={area} />
          <TreeMark size={26} />
          <span className="font-display font-bold text-heading">{area === "ops" ? "Console" : "Portal"}</span>
          <div className="ml-auto"><ThemeToggle current={theme === "dark" ? "dark" : "light"} /></div>
        </header>
        {banner}
        <main id="app-main" className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, description, actions, crumbs }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {crumbs && (
          <p className="mb-1 text-sm text-muted">
            {crumbs.map((c, i) => (
              <span key={c.href}>
                {i > 0 && " / "}
                <Link href={c.href} className="hover:underline">{c.label}</Link>
              </span>
            ))}
          </p>
        )}
        <h1 className="font-display text-2xl font-bold text-heading sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          {title && <h2 className="font-semibold text-heading">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  const hasRows = Children.toArray(children).length > 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {!hasRows && empty ? <div className="px-3 py-6 text-center text-sm text-muted">{empty}</div> : null}
    </div>
  );
}

const TONES: Record<string, string> = {
  neutral: "bg-surface-2 text-muted",
  good: "bg-success-bg text-success",
  warn: "bg-warning-bg text-warning",
  bad: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  brand: "bg-copper/15 text-copper-ink",
};
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES | string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone] ?? TONES.neutral}`}>{children}</span>;
}

export function Kpi({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "warn" | "bad" | "good" }) {
  const body = (
    <div className={`h-full rounded-2xl border bg-surface p-4 ${tone === "bad" ? "border-danger/40" : tone === "warn" ? "border-warning/40" : "border-line"} ${href ? "transition hover:shadow-[var(--shadow-soft)]" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-heading">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
