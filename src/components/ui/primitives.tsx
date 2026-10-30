import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./Icon";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Container({ className, children, wide }: { className?: string; children: ReactNode; wide?: boolean }) {
  return <div className={cx("mx-auto w-full px-4 sm:px-6 lg:px-8", wide ? "max-w-[88rem]" : "max-w-7xl", className)}>{children}</div>;
}

export function Section({ className, children, tone = "default", id, labelledBy }: { className?: string; children: ReactNode; tone?: "default" | "sand" | "teal" | "dark" | "white"; id?: string; labelledBy?: string }) {
  const tones = { default: "", sand: "bg-sand/55", teal: "bg-teal-50", dark: "surface-brand text-sand", white: "bg-white" };
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx("py-16 sm:py-24", tones[tone], className)}>
      {children}
    </section>
  );
}

export function Eyebrow({ children, className, tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "light" }) {
  return <p className={cx("text-[0.78rem] font-semibold uppercase tracking-[0.14em]", tone === "light" ? "text-copper" : "text-copper-ink", className)}>{children}</p>;
}

export function Heading({ as: As = "h2", children, className, id, size = "lg" }: { as?: "h1" | "h2" | "h3"; children: ReactNode; className?: string; id?: string; size?: "xl" | "lg" | "md" | "sm" }) {
  const sizes = {
    xl: "text-[2.4rem] leading-[1.05] sm:text-6xl lg:text-[4.4rem]",
    lg: "text-3xl leading-tight sm:text-[2.6rem]",
    md: "text-2xl leading-snug sm:text-3xl",
    sm: "text-xl leading-snug",
  };
  return (
    <As id={id} className={cx("font-display font-semibold tracking-tight", sizes[size], className)}>
      {children}
    </As>
  );
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-lg leading-relaxed text-muted sm:text-xl", className)}>{children}</p>;
}

type Variant = "primary" | "secondary" | "ghost" | "light" | "outline-light" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brown text-white hover:bg-brown-hover shadow-[var(--shadow-soft)]",
  secondary: "bg-white text-espresso ring-1 ring-inset ring-line hover:ring-sand-strong hover:bg-ivory",
  ghost: "text-espresso hover:bg-sand/60",
  light: "bg-ivory text-espresso hover:bg-white",
  "outline-light": "text-ivory ring-1 ring-inset ring-ivory/40 hover:bg-white/10",
  danger: "bg-danger text-white hover:opacity-90",
};
const sizes = { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-[0.95rem]", lg: "h-13 px-6 text-base" };

export function ButtonLink({ href, variant = "primary", size = "md", children, className, icon, ...rest }: { href: string; variant?: Variant; size?: keyof typeof sizes; children: ReactNode; className?: string; icon?: string } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors", variants[variant], sizes[size], className)} {...rest}>
      {children}
      {icon && <Icon name={icon} size={18} />}
    </Link>
  );
}

export function Button({ variant = "primary", size = "md", children, className, icon, ...rest }: { variant?: Variant; size?: keyof typeof sizes; icon?: string } & ComponentProps<"button">) {
  return (
    <button className={cx("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55", variants[variant], sizes[size], className)} {...rest}>
      {children}
      {icon && <Icon name={icon} size={18} />}
    </button>
  );
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center gap-1.5 font-semibold text-copper-ink underline-offset-4 hover:underline", className)}>
      {children}
      <Icon name="arrow-right" size={16} />
    </Link>
  );
}

export function Card({ children, className, as: As = "div", interactive }: { children: ReactNode; className?: string; as?: "div" | "article" | "li"; interactive?: boolean }) {
  return (
    <As className={cx("rounded-[var(--radius-card)] border border-line bg-surface p-6", interactive && "transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]", className)}>
      {children}
    </As>
  );
}

export function Pill({ children, className, tone = "sand" }: { children: ReactNode; className?: string; tone?: "sand" | "dark" | "copper" | "white" }) {
  const t = { sand: "bg-sand text-espresso", dark: "surface-brand text-ivory", copper: "bg-copper/15 text-copper-ink", white: "bg-white text-espresso ring-1 ring-line" };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", t[tone], className)}>{children}</span>;
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <Icon name="chevron-right" size={14} className="opacity-50" />}
            {it.href && i < items.length - 1 ? (
              <Link href={it.href} className="hover:text-espresso hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-espresso">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function CheckList({ items, className, tone = "default" }: { items: ReactNode[]; className?: string; tone?: "default" | "light" }) {
  return (
    <ul className={cx("space-y-2.5", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", tone === "light" ? "bg-copper/25 text-copper" : "bg-sand text-brown")}>
            <Icon name="check" size={13} strokeWidth={2.5} />
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "success" | "danger" | "neutral"; title?: string; children: ReactNode; className?: string }) {
  const t = {
    info: "bg-info-bg text-info border-info/20",
    warning: "bg-warning-bg text-warning border-warning/25",
    success: "bg-success-bg text-success border-success/20",
    danger: "bg-danger-bg text-danger border-danger/20",
    neutral: "bg-surface-2 text-text border-line",
  };
  const icon = { info: "info", warning: "alert", success: "check", danger: "alert", neutral: "info" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cx("flex gap-3 rounded-2xl border p-4 text-sm", t[tone], className)}>
      <Icon name={icon} size={18} className="mt-0.5 shrink-0" />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-[0.92rem] leading-relaxed [&_a]:underline">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-line bg-surface p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-heading">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface-2/50 px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sand text-brown">
        <Icon name={icon} />
      </span>
      <p className="mt-4 font-semibold text-heading">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Faqs({ items, className }: { items: { q: string; a: string }[]; className?: string }) {
  return (
    <div className={cx("divide-y divide-line rounded-2xl border border-line bg-surface", className)}>
      {items.map((f, i) => (
        <details key={i} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-heading">
            {f.q}
            <Icon name="chevron-down" size={18} className="mt-1 shrink-0 transition group-open:rotate-180" />
          </summary>
          <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
