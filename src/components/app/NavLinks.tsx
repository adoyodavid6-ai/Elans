"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  exact?: boolean;
}

export function NavLinks({ nav, onNavigate }: { nav: { section?: string; items: NavItem[] }[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="space-y-5">
      {nav.map((g, i) => (
        <div key={i}>
          {g.section && <p className="mb-1 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{g.section}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cx("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition", active ? "bg-brown text-white" : "text-text hover:bg-surface-2")}>
                    <Icon name={it.icon} size={17} />
                    <span className="flex-1">{it.label}</span>
                    {it.badge ? <span className={cx("rounded-full px-1.5 text-xs font-semibold", active ? "bg-white/20" : "bg-copper/20 text-copper-ink")}>{it.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
