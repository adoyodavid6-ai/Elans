import Link from "next/link";
import type { Solution } from "@/content/types";
import type { Catalogue } from "@/lib/content";
import { StatusBadge } from "@/components/ui/Status";
import { PackageFrom } from "./Price";

export function SolutionCard({ s, cat, showCategory = true }: { s: Solution; cat: Catalogue; showCategory?: boolean }) {
  const category = cat.categories.find((c) => c.slug === s.category);
  return (
    <article className="relative flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-3">
        {showCategory && <span className="text-xs font-semibold uppercase tracking-wide text-copper-ink">{category?.name}</span>}
        <StatusBadge status={s.status} className="ml-auto shrink-0" />
      </div>
      <h3 className="mt-2.5 text-[1.05rem] font-semibold leading-snug text-heading">
        <Link href={`/solutions/${s.category}/${s.slug}`} className="after:absolute after:inset-0 hover:underline">
          {s.name}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span>{s.timeline}</span>
        <span aria-hidden>·</span>
        <span className="capitalize">{s.complexity} complexity</span>
      </div>
      <div className="mt-2">
        <PackageFrom cat={cat} pkg={s.pricing.package} compact className="text-xs" />
      </div>
    </article>
  );
}
