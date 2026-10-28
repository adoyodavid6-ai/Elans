"use client";

import { useState } from "react";
import type { IllustrativeExample } from "@/content/types";
import { BeforeAfter } from "@/components/ui/WorkflowDiagram";
import { IllustrativeTag } from "@/components/ui/Status";
import { cx } from "@/components/ui/primitives";

export function DemoTabs({ examples }: { examples: IllustrativeExample[] }) {
  const [i, setI] = useState(0);
  const ex = examples[i];
  return (
    <div>
      <div role="tablist" aria-label="Workflow examples" className="flex flex-wrap gap-2">
        {examples.map((e, j) => (
          <button key={e.slug} role="tab" id={`tab-${e.slug}`} aria-selected={i === j} aria-controls={`panel-${e.slug}`} onClick={() => setI(j)} className={cx("rounded-full px-4 py-2 text-sm font-semibold transition", i === j ? "bg-espresso text-ivory" : "bg-white text-espresso ring-1 ring-line hover:bg-sand/50")}>
            {e.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${ex.slug}`} aria-labelledby={`tab-${ex.slug}`} className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <IllustrativeTag />
          <p className="text-sm text-muted">{ex.scenario}</p>
        </div>
        <BeforeAfter before={ex.before} after={ex.after} />
        <p className="mt-4 text-sm text-muted">
          <span className="font-semibold text-heading">What we would measure:</span> {ex.whatWeMeasure.join(" · ")}
        </p>
      </div>
    </div>
  );
}
