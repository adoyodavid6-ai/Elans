"use client";

import Link from "next/link";
import { useState } from "react";
import { masterCore } from "@/lib/core/roi";
import { formatMoney, formatNumber } from "@/lib/core/money";

export function MiniRoi({ setup, monthly }: { setup: number; monthly: number }) {
  const [tasks, setTasks] = useState(800);
  const [minutes, setMinutes] = useState(6);
  const [hourly, setHourly] = useState(700);
  const r = masterCore({ tasksPerMonth: tasks, minutesPerTask: minutes, hourlyCost: hourly, errorRatePct: 4, costPerError: 1500, coveragePct: 70, errorReductionPct: 60, reviewMinutesPerTask: 1, implementationFee: setup, monthlyFee: monthly, usageCostPerMonth: 3000, maintenancePerYear: 0, incrementalRevenuePerYear: 0 });
  const field = (id: string, label: string, value: number, set: (n: number) => void, min: number, max: number, step: number, suffix: string) => (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-sand">
          {label}
        </label>
        <output htmlFor={id} className="font-display text-lg font-semibold text-ivory">
          {formatNumber(value)}
          {suffix}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-2 w-full accent-copper" />
    </div>
  );
  return (
    <div className="grid gap-8 rounded-[2rem] surface-brand p-6 text-sand lg:grid-cols-2 lg:p-10">
      <div className="space-y-6">
        {field("roi-tasks", "Times the task happens each month", tasks, setTasks, 50, 5000, 50, "")}
        {field("roi-min", "Minutes per task", minutes, setMinutes, 1, 60, 1, " min")}
        {field("roi-hourly", "Fully loaded cost per staff hour (KES)", hourly, setHourly, 200, 3000, 50, "")}
        <p className="text-xs leading-relaxed text-sand/70">Assumes 70% coverage, 1 minute of human review per automated task, and an Elans Launch package. Every assumption is editable in the full calculator.</p>
      </div>
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {[
          ["Hours freed per year", `${formatNumber(r.hoursSaved)} h`, "Labour capacity, not cash"],
          ["Labour-capacity value", formatMoney(r.labourCapacity), "If the time is redeployed"],
          ["First-year solution cost", formatMoney(r.firstYearCost), "Setup + 12 months"],
          ["Payback", r.paybackMonths === null ? "Not reached" : `${formatNumber(r.paybackMonths, 1)} months`, "On these inputs"],
        ].map(([l, v, h]) => (
          <div key={l} className="rounded-2xl bg-white/6 p-4 ring-1 ring-white/10">
            <p className="text-xs uppercase tracking-wide text-sand/70">{l}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ivory">{v}</p>
            <p className="text-xs text-sand/60">{h}</p>
          </div>
        ))}
        <Link href={`/roi/master?tasksPerMonth=${tasks}&minutesPerTask=${minutes}&hourlyCost=${hourly}`} className="col-span-full mt-2 inline-flex h-11 items-center justify-center rounded-full bg-copper px-5 text-sm font-semibold text-espresso hover:bg-wine-300">
          Open the full calculator with formulas →
        </Link>
      </div>
    </div>
  );
}
