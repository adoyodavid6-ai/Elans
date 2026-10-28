import type { Catalogue } from "@/lib/content";
import { formatMoney } from "@/lib/core/money";
import type { PackageKey } from "@/content/types";
import { cx } from "@/components/ui/primitives";

export function priceLabel(cat: Catalogue, key: string) {
  const p = cat.pricePoints.find((x) => x.key === key);
  if (!p) return { text: "Quoted", confirmed: true };
  return { text: p.amount === null ? "Quoted" : formatMoney(p.amount, p.currency), confirmed: p.confirmed, amount: p.amount };
}

export function IndicativeTag() {
  return (
    <abbr title="Suggested starting price, pending final confirmation. Your quote confirms the actual price." className="ml-1 inline-block cursor-help whitespace-nowrap rounded bg-sand px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted no-underline">
      Indicative
    </abbr>
  );
}

/** "From KES 120,000 setup · KES 20,000/month" for a package, or "Quoted". */
export function PackageFrom({ cat, pkg, className, compact }: { cat: Catalogue; pkg: PackageKey | "quoted"; className?: string; compact?: boolean }) {
  if (pkg === "quoted" || pkg === "enterprise") return <span className={cx("text-sm font-semibold text-heading", className)}>Quoted after assessment</span>;
  const p = cat.packages.find((x) => x.key === pkg);
  if (!p) return null;
  const s = priceLabel(cat, p.setupKey);
  const m = priceLabel(cat, p.monthlyKey);
  return (
    <span className={cx("text-sm text-muted", className)}>
      <span className="font-semibold text-heading">From {s.text}</span> setup{compact ? " · " : " + "}
      <span className="font-semibold text-heading">{m.text}</span>/month
      {(!s.confirmed || !m.confirmed) && <IndicativeTag />}
      {!compact && <span className="block text-xs">via {p.name}</span>}
    </span>
  );
}
