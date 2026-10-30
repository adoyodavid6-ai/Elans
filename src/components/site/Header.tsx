"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface MenuLink {
  href: string;
  label: string;
  hint?: string;
}
export interface MenuGroup {
  title: string;
  links: MenuLink[];
}
export interface MegaMenu {
  key: string;
  label: string;
  href: string;
  groups: MenuGroup[];
  feature?: { title: string; body: string; href: string; cta: string };
}

export function Header({ menus }: { menus: MegaMenu[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : "";
  }, [mobile]);

  // Main bar (logo, four menus, primary CTA) sits on top; secondary links live in the utility bar beneath it.
  const simple = [
    { href: "/how-it-works", label: "How It Works" },
    { href: "/pricing", label: "Pricing" },
    { href: "/resources", label: "Resources" },
  ];
  const utility = [...simple, { href: "/partners", label: "Partners" }, { href: "/contact", label: "Contact" }];

  return (
    <header className="no-print sticky top-0 z-40">
      {/* Tier 1: main bar */}
      <div className="border-b border-line/80 bg-ivory/92 backdrop-blur supports-[backdrop-filter]:bg-ivory/80">
      <div className="mx-auto flex h-16 max-w-[88rem] items-center gap-4 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
        <Link href="/" aria-label="Elans home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav ref={navRef} aria-label="Primary" className="ml-4 hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {menus.map((m) => (
              <li key={m.key} className="relative">
                <button
                  type="button"
                  aria-expanded={open === m.key}
                  aria-controls={`menu-${m.key}`}
                  onClick={() => setOpen(open === m.key ? null : m.key)}
                  className={cx(
                    "flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[0.95rem] font-medium text-espresso hover:bg-sand/60",
                    (open === m.key || pathname.startsWith(m.href)) && "bg-sand/60",
                  )}
                >
                  {m.label}
                  <Icon name="chevron-down" size={15} className={cx("transition", open === m.key && "rotate-180")} />
                </button>
                {open === m.key && <MegaPanel menu={m} />}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/portal/login" aria-label="Client Login" title="Client Login" className="hidden h-10 w-10 place-items-center rounded-full text-espresso hover:bg-sand/60 sm:grid lg:hidden">
            <Icon name="user" size={18} />
          </Link>
          <Link href="/assessment" className="hidden items-center gap-2 whitespace-nowrap rounded-full bg-brown px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:bg-brown-hover md:inline-flex">
            <span className="hidden xl:inline">Find Your Automation Opportunities</span>
            <span className="xl:hidden">Find opportunities</span>
            <Icon name="arrow-right" size={16} />
          </Link>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-espresso hover:bg-sand/60 lg:hidden" aria-label={mobile ? "Close menu" : "Open menu"} aria-expanded={mobile} aria-controls="mobile-menu" onClick={() => setMobile(!mobile)}>
            <Icon name={mobile ? "x" : "menu"} size={22} />
          </button>
        </div>
      </div>
      </div>
      {/* Tier 2: utility bar (below the main bar) */}
      <div className="surface-brand hidden text-white lg:block">
        <div className="mx-auto flex h-9 max-w-[88rem] items-center gap-6 px-4 text-[0.8rem] sm:px-6 lg:px-8">
          <p className="hidden truncate text-white/80 xl:block">AI automation &amp; growth for businesses in Kenya and East Africa</p>
          <nav aria-label="Secondary" className="ml-auto">
            <ul className="flex items-center gap-1">
              {utility.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} aria-current={pathname.startsWith(l.href) ? "page" : undefined} className={cx("whitespace-nowrap rounded-full px-2.5 py-1 font-medium text-white/85 hover:bg-white/10 hover:text-white", pathname.startsWith(l.href) && "bg-white/15 text-white")}>
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="ml-2 border-l border-white/20 pl-3">
                <Link href="/sessions" className="whitespace-nowrap rounded-full px-2.5 py-1 font-medium text-white/85 hover:bg-white/10 hover:text-white">Book a session</Link>
              </li>
              <li>
                <Link href="/portal/login" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 font-semibold text-white hover:bg-white/20">
                  <Icon name="user" size={14} /> Client Login
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>


      {mobile && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-ivory px-4 pb-28 pt-4 lg:hidden">
          <nav aria-label="Mobile">
            {menus.map((m) => (
              <details key={m.key} className="group border-b border-line py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-lg font-semibold text-espresso">
                  {m.label}
                  <Icon name="chevron-down" className="transition group-open:rotate-180" />
                </summary>
                <div className="space-y-4 pb-4">
                  {m.groups.map((g) => (
                    <div key={g.title}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-copper-ink">{g.title}</p>
                      <ul className="grid grid-cols-1 gap-0.5">
                        {g.links.map((l) => (
                          <li key={l.href}>
                            <Link href={l.href} className="block rounded-lg px-2 py-2 text-[0.95rem] text-text hover:bg-sand/60">
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <Link href={m.href} className="inline-flex items-center gap-1 px-2 text-sm font-semibold text-copper-ink">
                    View all <Icon name="arrow-right" size={14} />
                  </Link>
                </div>
              </details>
            ))}
            {[...simple, { href: "/assessment", label: "AI Opportunity Assessment" }, { href: "/roi", label: "ROI calculators" }, { href: "/integrations", label: "Integrations" }, { href: "/trust", label: "Trust & security" }, { href: "/partners", label: "Partners" }, { href: "/contact", label: "Contact" }, { href: "/sessions", label: "Book a session" }, { href: "/portal/login", label: "Client Login" }].map((l) => (
              <Link key={l.href} href={l.href} className="block border-b border-line py-3.5 text-lg font-semibold text-espresso">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

function MegaPanel({ menu }: { menu: MegaMenu }) {
  return (
    <div id={`menu-${menu.key}`} className="absolute left-0 top-full z-50 mt-2 w-[min(64rem,calc(100vw-4rem))] rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-lift)]" role="region" aria-label={`${menu.label} menu`}>
      <div className="grid gap-6" style={{ gridTemplateColumns: menu.feature ? "repeat(3, minmax(0,1fr)) 15rem" : "repeat(3, minmax(0,1fr))" }}>
        {menu.groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-copper-ink">{g.title}</p>
            <ul className="space-y-0.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block rounded-lg px-2 py-1.5 hover:bg-sand/50">
                    <span className="block text-[0.92rem] font-medium text-espresso">{l.label}</span>
                    {l.hint && <span className="block text-xs text-muted">{l.hint}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {menu.feature && (
          <div className="rounded-2xl surface-brand p-5 text-sand">
            <p className="font-display text-lg font-semibold text-ivory">{menu.feature.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-sand/85">{menu.feature.body}</p>
            <Link href={menu.feature.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-copper">
              {menu.feature.cta} <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <Link href={menu.href} className="inline-flex items-center gap-1 text-sm font-semibold text-copper-ink hover:underline">
          Browse all {menu.label.toLowerCase()} <Icon name="arrow-right" size={14} />
        </Link>
        {menu.key === "solutions" && (
          <Link href="/solutions#search" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-espresso">
            <Icon name="search" size={15} /> Search the catalogue
          </Link>
        )}
      </div>
    </div>
  );
}
