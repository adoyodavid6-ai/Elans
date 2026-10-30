"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface MiniOption {
  slug: string;
  name: string;
  summary: string;
  href: string;
  status: string;
  industries: string[];
  pains: string[];
}

const PAINS = [
  { key: "messages", label: "Customers wait for replies", icon: "chat" },
  { key: "payments", label: "Matching payments takes hours", icon: "money" },
  { key: "tax", label: "eTIMS & statutory compliance", icon: "shield" },
  { key: "arrears", label: "Unpaid invoices & arrears", icon: "clock" },
  { key: "documents", label: "Typing up documents", icon: "doc" },
  { key: "growth", label: "Not enough leads or visibility", icon: "megaphone" },
];

export function MiniAssessment({ industries, options }: { industries: { slug: string; short: string }[]; options: MiniOption[] }) {
  const [industry, setIndustry] = useState("general-smes");
  const [pain, setPain] = useState<string | null>(null);
  const results = useMemo(() => {
    if (!pain) return [];
    return options
      .filter((o) => o.pains.includes(pain))
      .map((o) => ({ o, s: (o.industries.includes(industry) ? 2 : 0) + (o.status === "pilot" ? 0.5 : 0) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((x) => x.o);
  }, [pain, industry, options]);

  return (
    <div className="grid gap-8 rounded-[2rem] border border-line bg-white p-6 shadow-[var(--shadow-soft)] lg:grid-cols-[1fr_1.1fr] lg:p-10">
      <div>
        <label htmlFor="mini-industry" className="text-sm font-semibold text-heading">
          1. Your industry
        </label>
        <select id="mini-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-line bg-ivory px-3 text-[0.95rem]">
          {industries.map((i) => (
            <option key={i.slug} value={i.slug}>
              {i.short}
            </option>
          ))}
        </select>
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-heading">2. Your biggest headache right now</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PAINS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={pain === p.key}
                onClick={() => setPain(p.key)}
                className={cx("flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition", pain === p.key ? "border-brown bg-brown text-white" : "border-line bg-ivory text-espresso hover:border-sand-strong")}
              >
                <Icon name={p.icon} size={18} />
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div aria-live="polite" className="flex flex-col">
        <p className="text-sm font-semibold text-heading">3. Where we would start</p>
        {!pain ? (
          <div className="mt-2 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line bg-ivory p-8 text-center text-sm text-muted">Pick a headache to see the solutions that usually help first.</div>
        ) : (
          <ul className="mt-2 space-y-3">
            {results.map((r, i) => (
              <li key={r.slug}>
                <Link href={r.href} className="group flex gap-4 rounded-2xl border border-line bg-ivory p-4 hover:border-sand-strong hover:bg-white">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full surface-brand font-display text-sm font-bold text-ivory">{i + 1}</span>
                  <span>
                    <span className="block font-semibold text-heading group-hover:underline">{r.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">{r.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-6">
          <Link href={`/assessment?industry=${industry}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-brown px-5 text-sm font-semibold text-white hover:bg-brown-hover">
            Get your full scored report (free, 10 minutes) <Icon name="arrow-right" size={16} />
          </Link>
          <p className="mt-2 text-xs text-muted">This quick view is a starting point, not a recommendation. The full assessment scores each opportunity and shows its reasoning.</p>
        </div>
      </div>
    </div>
  );
}
