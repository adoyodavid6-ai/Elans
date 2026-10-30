"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface CatalogueItem {
  slug: string;
  name: string;
  summary: string;
  href: string;
  category: string;
  categoryName: string;
  division: string;
  industries: string[];
  complexity: string;
  timeline: string;
  status: string;
  priceBand: string;
  priceLabel: string;
  search: string;
}
interface Opt {
  value: string;
  label: string;
}

const STATUS_LABEL: Record<string, string> = { live: "Live", pilot: "Pilot", planned: "Planned", custom: "Custom assessment" };
const STATUS_CLS: Record<string, string> = { live: "bg-success-bg text-success", pilot: "bg-info-bg text-info", planned: "bg-surface-2 text-muted", custom: "bg-warning-bg text-warning" };

export function CatalogueBrowser({ items, categories, industries, divisions }: { items: CatalogueItem[]; categories: Opt[]; industries: Opt[]; divisions: Opt[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const f = {
    category: sp.get("category") ?? "",
    industry: sp.get("industry") ?? "",
    division: sp.get("division") ?? "",
    complexity: sp.get("complexity") ?? "",
    status: sp.get("status") ?? "",
    price: sp.get("price") ?? "",
  };

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(
    () =>
      items.filter(
        (i) =>
          (!f.category || i.category === f.category) &&
          (!f.industry || i.industries.includes(f.industry)) &&
          (!f.division || i.division === f.division) &&
          (!f.complexity || i.complexity === f.complexity) &&
          (!f.status || i.status === f.status) &&
          (!f.price || i.priceBand === f.price) &&
          terms.every((t) => i.search.includes(t)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, sp, q],
  );
  const active = Object.values(f).filter(Boolean).length + (q ? 1 : 0);

  const select = (key: keyof typeof f, label: string, opts: Opt[]) => (
    <div>
      <label htmlFor={`f-${key}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      <select id={`f-${key}`} value={f[key]} onChange={(e) => set(key, e.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
        <option value="">All</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <div id="search" className="rounded-3xl border border-teal-100 bg-teal-50 p-4 sm:p-6">
        <label htmlFor="catalogue-q" className="sr-only">
          Search solutions
        </label>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="catalogue-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => set("q", q)}
            placeholder="Search by task or problem, e.g. 'fee arrears', 'eTIMS', 'missed calls'"
            className="h-13 w-full rounded-2xl border border-line bg-white pl-12 pr-4 text-[0.98rem] shadow-sm"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {select("category", "Function", categories)}
          {select("industry", "Industry", industries)}
          {select("division", "Division", divisions)}
          {select("complexity", "Complexity", [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ])}
          {select("status", "Status", Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })))}
          {select("price", "Starting price", [
            { value: "launch", label: "Launch tier" },
            { value: "growth", label: "Growth tier" },
            { value: "scale", label: "Scale tier" },
            { value: "quoted", label: "Quoted" },
          ])}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm text-muted">
          <span className="font-semibold text-heading">{results.length}</span> of {items.length} solutions
        </p>
        {active > 0 && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              start(() => router.replace(pathname, { scroll: false }));
            }}
            className="text-sm font-semibold text-copper-ink hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-semibold text-heading">No catalogue solution matches.</p>
          <p className="mt-1 text-sm text-muted">Many processes need a custom design. Tell us about yours.</p>
          <Link href="/assessment" className="mt-4 inline-flex h-10 items-center rounded-full bg-brown px-4 text-sm font-semibold text-white">
            Take the assessment
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((i) => (
            <li key={i.slug}>
              <article className="relative flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-copper-ink">{i.categoryName}</span>
                  <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_CLS[i.status])}>{STATUS_LABEL[i.status]}</span>
                </div>
                <h3 className="mt-2.5 text-[1.05rem] font-semibold leading-snug text-heading">
                  <Link href={i.href} className="after:absolute after:inset-0 hover:underline">
                    {i.name}
                  </Link>
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{i.summary}</p>
                <div className="rule-blend-soft mt-4 border-t pt-3 text-xs text-muted">
                  {i.timeline} · <span className="capitalize">{i.complexity}</span> complexity · {i.priceLabel}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
