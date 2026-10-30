"use client";

import { useMemo, useState, useTransition } from "react";
import { getCalculator, sanitiseInputs, type RoiOutput } from "@/lib/core/roi";
import { saveRoiScenario } from "@/app/actions/roi";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

const KIND_CLS: Record<string, string> = {
  capacity: "border-copper/40 bg-copper/10",
  cash: "border-success/25 bg-success-bg",
  cost: "border-line bg-surface-2",
  ratio: "border-line bg-white",
  info: "border-line bg-white",
  time: "border-line bg-white",
};
const KIND_LABEL: Record<string, string> = { capacity: "Labour capacity", cash: "Cash effect", cost: "Cost", ratio: "Ratio", info: "Baseline", time: "Time" };
const CURRENCIES = ["KES", "UGX", "TZS", "RWF", "USD", "GBP", "EUR"];

export function RoiCalculatorView({ slug, initial }: { slug: string; initial: Record<string, number> }) {
  const calc = getCalculator(slug)!;
  const [inputs, setInputs] = useState<Record<string, number>>(() => sanitiseInputs(calc, initial));
  const [currency, setCurrency] = useState("KES");
  const result = useMemo(() => calc.compute(inputs, currency), [calc, inputs, currency]);
  const groups = [...new Set(calc.fields.map((f) => f.group ?? "Inputs"))];
  const [save, setSave] = useState({ open: false, name: "", email: "", organisation: "", consent: false, marketing: false, msg: "", ok: false });
  const [pending, start] = useTransition();

  const unit = (u: string) => ({ minutes: "min", percent: "%", money: currency, days: "days", hours: "h", count: "" })[u] ?? "";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="space-y-6" onSubmit={(e) => e.preventDefault()} aria-label="Calculator inputs">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4">
          <label htmlFor="currency" className="text-sm font-semibold text-heading">
            Currency
          </label>
          <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-2 text-sm">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {groups.map((g) => (
          <fieldset key={g} className="rounded-2xl border border-line bg-white p-5">
            <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-copper-ink">{g}</legend>
            <div className="mt-2 space-y-5">
              {calc.fields
                .filter((f) => (f.group ?? "Inputs") === g)
                .map((f) => (
                  <div key={f.key}>
                    <label htmlFor={f.key} className="block text-sm font-medium text-heading">
                      {f.label}
                      {f.optional && <span className="font-normal text-muted"> (optional)</span>}
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      {f.unit === "money" && <span className="text-sm text-muted">{currency}</span>}
                      <input
                        id={f.key}
                        type="number"
                        inputMode="decimal"
                        value={Number.isFinite(inputs[f.key]) ? inputs[f.key] : ""}
                        min={f.min}
                        max={f.max}
                        step={f.step ?? "any"}
                        onChange={(e) => setInputs((p) => ({ ...p, [f.key]: e.target.value === "" ? 0 : Number(e.target.value) }))}
                        className="h-11 w-full rounded-xl border border-line bg-white px-3 text-[0.95rem] focus:border-brown focus:outline-none focus:ring-2 focus:ring-copper/40"
                        aria-describedby={f.help ? `${f.key}-help` : undefined}
                      />
                      {f.unit !== "money" && unit(f.unit) && <span className="w-10 text-sm text-muted">{unit(f.unit)}</span>}
                    </div>
                    {f.help && (
                      <p id={`${f.key}-help`} className="mt-1 text-xs text-muted">
                        {f.help.replace("{{STATUTORY_RATES}}", "rates are configurable")}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </fieldset>
        ))}
        <button type="button" onClick={() => setInputs(sanitiseInputs(calc, Object.fromEntries(calc.fields.map((f) => [f.key, f.default]))))} className="text-sm font-semibold text-copper-ink hover:underline">
          Reset to example values
        </button>
      </form>

      <div className="space-y-6 lg:sticky lg:top-32 lg:self-start">
        <section aria-live="polite" aria-label="Results" className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold">Results</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {result.outputs.map((o) => (
              <OutputTile key={o.key} o={o} />
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">{result.disclaimer}</p>
        </section>

        {result.scenarios && (
          <section className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6" aria-labelledby="scen-h">
            <h2 id="scen-h" className="font-display text-xl font-semibold">Low / base / high scenarios</h2>
            <table className="mt-4 w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Measure</th>
                  {result.scenarios.map((s) => (
                    <th key={s.name} className="py-2 pr-3">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.scenarios[1].outputs.map((o, i) => (
                  <tr key={o.key}>
                    <td className="py-2 pr-3 text-muted">{o.label}</td>
                    {result.scenarios!.map((s) => (
                      <td key={s.name} className={cx("py-2 pr-3 font-medium", s.name === "Base" && "text-heading")}>
                        {s.outputs[i].display}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {result.scenarios.map((s) => (
                <li key={s.name}>
                  <strong>{s.name}:</strong> {s.note}
                </li>
              ))}
            </ul>
          </section>
        )}

        <details className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6" open>
          <summary className="cursor-pointer font-display text-xl font-semibold">Formulas & assumptions</summary>
          <ul className="mt-4 space-y-1.5 font-mono text-xs leading-relaxed text-text">
            {result.formulas.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            {result.assumptions.map((a) => (
              <li key={a} className="flex gap-2">
                <Icon name="info" size={15} className="mt-0.5 shrink-0" /> {a}
              </li>
            ))}
          </ul>
        </details>

        <section className="rounded-[var(--radius-card)] bg-sand/50 p-5 sm:p-6">
          {!save.open ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">Want a copy, or a consultant to sanity-check your assumptions?</p>
              <button type="button" onClick={() => setSave((s) => ({ ...s, open: true }))} className="inline-flex h-10 items-center gap-2 rounded-full bg-brown px-4 text-sm font-semibold text-white">
                Email me this estimate
              </button>
            </div>
          ) : save.ok ? (
            <p role="status" className="text-sm font-medium text-success">{save.msg}</p>
          ) : (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await saveRoiScenario({ calculator: slug, inputs, currency, name: save.name, email: save.email, organisation: save.organisation, consentContact: save.consent, consentMarketing: save.marketing });
                  setSave((s) => ({ ...s, msg: r.message, ok: r.ok }));
                });
              }}
            >
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Name</span>
                <input required value={save.name} onChange={(e) => setSave((s) => ({ ...s, name: e.target.value }))} className="h-11 w-full rounded-xl border border-line bg-white px-3" autoComplete="name" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Email</span>
                <input required type="email" value={save.email} onChange={(e) => setSave((s) => ({ ...s, email: e.target.value }))} className="h-11 w-full rounded-xl border border-line bg-white px-3" autoComplete="email" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold">Organisation (optional)</span>
                <input value={save.organisation} onChange={(e) => setSave((s) => ({ ...s, organisation: e.target.value }))} className="h-11 w-full rounded-xl border border-line bg-white px-3" autoComplete="organization" />
              </label>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={save.consent} onChange={(e) => setSave((s) => ({ ...s, consent: e.target.checked }))} className="mt-0.5 h-5 w-5 accent-brown" required />
                <span>
                  Elans may use these details to send this estimate and follow up (see the <a className="underline" href="/legal/privacy">privacy notice</a>).
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={save.marketing} onChange={(e) => setSave((s) => ({ ...s, marketing: e.target.checked }))} className="mt-0.5 h-5 w-5 accent-brown" />
                <span>Send me occasional insights (optional).</span>
              </label>
              {save.msg && <p role="alert" className="text-sm text-danger sm:col-span-2">{save.msg}</p>}
              <button disabled={pending} className="inline-flex h-11 items-center justify-center rounded-full bg-brown px-5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">
                {pending ? "Saving…" : "Send my estimate"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function OutputTile({ o }: { o: RoiOutput }) {
  return (
    <li className={cx("rounded-2xl border p-4", KIND_CLS[o.kind], o.emphasis && "sm:col-span-2")}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{KIND_LABEL[o.kind]}</p>
      <p className="mt-0.5 text-sm text-text">{o.label}</p>
      <p className={cx("mt-1 font-display font-semibold text-heading", o.emphasis ? "text-3xl" : "text-xl")}>{o.display}</p>
    </li>
  );
}
