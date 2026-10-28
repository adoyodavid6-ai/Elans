import type { IntegrationStatus, Status } from "@/content/types";
import { cx } from "./primitives";

const STATUS: Record<Status, { label: string; cls: string; title: string }> = {
  live: { label: "Live", cls: "bg-success-bg text-success ring-success/25", title: "Running in production for clients." },
  pilot: { label: "Pilot", cls: "bg-info-bg text-info ring-info/25", title: "Built and demonstrable; being proven with first pilot clients." },
  planned: { label: "Planned", cls: "bg-surface-2 text-muted ring-line", title: "Designed and scoped; not yet built. Available as a first-client build." },
  custom: { label: "Custom assessment", cls: "bg-warning-bg text-warning ring-warning/25", title: "Scoped individually after an assessment." },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = STATUS[status];
  return (
    <span title={s.title} className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", s.cls, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
      <span className="sr-only">: {s.title}</span>
    </span>
  );
}
export const statusMeta = STATUS;

const ISTATUS: Record<IntegrationStatus, { label: string; cls: string }> = {
  supported: { label: "Supported", cls: "bg-success-bg text-success ring-success/25" },
  planned: { label: "Planned", cls: "bg-surface-2 text-muted ring-line" },
  custom_assessment: { label: "Custom assessment", cls: "bg-warning-bg text-warning ring-warning/25" },
};
export function IntegrationBadge({ status }: { status: IntegrationStatus }) {
  const s = ISTATUS[status];
  return <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ring-1 ring-inset", s.cls)}>{s.label}</span>;
}

export function IllustrativeTag({ className, children = "Illustrative example" }: { className?: string; children?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border border-dashed border-copper/70 bg-copper/10 px-2.5 py-0.5 text-xs font-semibold text-copper-ink", className)}>
      ✦ {children}
    </span>
  );
}
