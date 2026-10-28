import type { Flow, FlowKind } from "@/content/types";
import { cx } from "./primitives";
import { Icon } from "./Icon";

const KIND: Record<FlowKind, { label: string; icon: string; cls: string }> = {
  input: { label: "Input", icon: "inbox", cls: "bg-white text-espresso ring-line" },
  manual: { label: "Manual step", icon: "user", cls: "bg-surface-2 text-text ring-line" },
  wait: { label: "Waiting", icon: "clock", cls: "bg-warning-bg text-warning ring-warning/25" },
  ai: { label: "AI step", icon: "spark", cls: "bg-copper/15 text-copper-ink ring-copper/30" },
  rule: { label: "Rule (deterministic)", icon: "layers", cls: "bg-info-bg text-info ring-info/25" },
  approval: { label: "Human approval", icon: "shield", cls: "bg-espresso text-ivory ring-espresso" },
  action: { label: "Action", icon: "bolt", cls: "bg-white text-brown ring-brown/30" },
  outcome: { label: "Outcome", icon: "target", cls: "bg-success-bg text-success ring-success/25" },
  risk: { label: "Risk / leakage", icon: "alert", cls: "bg-danger-bg text-danger ring-danger/25" },
};

/** Renders a before/after workflow from JSON. Vertical on mobile, a wrapping chain on wide screens. */
export function WorkflowDiagram({ flow, title, variant = "after", className }: { flow: Flow; title?: string; variant?: "before" | "after"; className?: string }) {
  return (
    <figure className={cx("rounded-[var(--radius-card)] border border-line p-5", variant === "before" ? "bg-surface-2/60" : "bg-white", className)}>
      {title && (
        <figcaption className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
          <span className={cx("h-2 w-2 rounded-full", variant === "before" ? "bg-danger" : "bg-success")} aria-hidden />
          {title}
        </figcaption>
      )}
      <ol className="relative space-y-2.5">
        {flow.map((s, i) => {
          const k = KIND[s.kind];
          return (
            <li key={i} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-inset", k.cls)} title={k.label}>
                  <Icon name={k.icon} size={15} />
                </span>
                {i < flow.length - 1 && <span className="my-0.5 w-px flex-1 bg-line" aria-hidden />}
              </div>
              <div className="pb-1 pt-1">
                <p className="text-[0.95rem] font-medium leading-snug text-heading">
                  <span className="sr-only">{k.label}: </span>
                  {s.label}
                </p>
                {s.note && <p className="mt-0.5 text-sm text-muted">{s.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export function BeforeAfter({ before, after, className }: { before: Flow; after: Flow; className?: string }) {
  return (
    <div className={cx("grid gap-4 md:grid-cols-2", className)}>
      <WorkflowDiagram flow={before} title="Today: manual workflow" variant="before" />
      <WorkflowDiagram flow={after} title="With Elans: automated workflow" variant="after" />
    </div>
  );
}

export function FlowLegend() {
  const shown: FlowKind[] = ["ai", "rule", "approval", "action", "outcome"];
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted" aria-label="Diagram legend">
      {shown.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={cx("grid h-5 w-5 place-items-center rounded-full ring-1 ring-inset", KIND[k].cls)}>
            <Icon name={KIND[k].icon} size={11} />
          </span>
          {KIND[k].label}
        </li>
      ))}
    </ul>
  );
}
