"use client";

import { useMemo, useState, useTransition } from "react";
import { evaluateQuote, maxDiscountForTerm, type QuoteLine } from "@/lib/core/quote";
import { saveQuote, sendQuote } from "@/app/ops/actions";
import { formatMoney } from "@/lib/core/money";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

const KINDS: QuoteLine["kind"][] = ["setup", "monthly", "usage", "one_off"];
const cell = "h-9 w-full rounded-md border border-line bg-surface px-2 text-sm";

export function QuoteBuilder(p: { id: string; status: string; initial: { lines: QuoteLine[]; termMonths: number; discountPct: number; splitSetup: boolean }; value90: number; marginFloor: number; minTerm: number; presets: { label: string; kind: QuoteLine["kind"]; amount: number }[]; solutions: { slug: string; name: string }[]; clientEmail: string; publicUrl: string | null; acceptedBy: string | null }) {
  const [lines, setLines] = useState<QuoteLine[]>(p.initial.lines);
  const [term, setTerm] = useState(p.initial.termMonths);
  const [discount, setDiscount] = useState(p.initial.discountPct);
  const [split, setSplit] = useState(p.initial.splitSetup);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editable = p.status === "draft";
  const ev = useMemo(() => evaluateQuote({ lines, termMonths: term, discountPct: discount, splitSetup: split, projected90DayValue: p.value90, marginFloor: p.marginFloor, minTermMonths: p.minTerm }), [lines, term, discount, split, p.value90, p.marginFloor, p.minTerm]);
  const upd = (i: number, patch: Partial<QuoteLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-heading">Lines</h2>
          {editable && (
            <select aria-label="Add a line from presets" className="h-9 rounded-md border border-line bg-surface px-2 text-sm" value="" onChange={(e) => { const pr = p.presets[Number(e.target.value)]; if (pr) setLines((ls) => [...ls, { kind: pr.kind, description: pr.label, amount: pr.amount, qty: 1, cost: Math.round(pr.amount * 0.3) }]); }}>
              <option value="">+ Add line…</option>
              {p.presets.map((pr, i) => <option key={i} value={i}>{pr.label} · {formatMoney(pr.amount)}</option>)}
            </select>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">Kind</th><th>Description</th><th>Solution</th><th className="w-28">Price</th><th className="w-16">Qty</th><th className="w-28">Elans cost</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2"><select disabled={!editable} value={l.kind} onChange={(e) => upd(i, { kind: e.target.value as QuoteLine["kind"] })} className={cell}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></td>
                  <td className="pr-2"><input disabled={!editable} value={l.description} onChange={(e) => upd(i, { description: e.target.value })} className={cell} /></td>
                  <td className="pr-2"><select disabled={!editable} value={l.solution ?? ""} onChange={(e) => upd(i, { solution: e.target.value || undefined })} className={cell}><option value="">—</option>{p.solutions.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></td>
                  <td className="pr-2"><input disabled={!editable} type="number" value={l.amount} onChange={(e) => upd(i, { amount: Number(e.target.value) })} className={cell} /></td>
                  <td className="pr-2"><input disabled={!editable} type="number" value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} className={cell} /></td>
                  <td className="pr-2"><input disabled={!editable} type="number" value={l.cost} onChange={(e) => upd(i, { cost: Number(e.target.value) })} className={cell} /></td>
                  <td>{editable && <button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-muted hover:text-danger"><Icon name="x" size={16} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block text-muted">Term (months)</span><input disabled={!editable} type="number" min={1} value={term} onChange={(e) => setTerm(Number(e.target.value))} className={cell} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted">Discount on monthly (%) · max {maxDiscountForTerm(term)}%</span><input disabled={!editable} type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className={cell} /></label>
          <label className="flex items-end gap-2 pb-2 text-sm"><input disabled={!editable} type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="h-4 w-4 accent-[#6B4936]" /> Split setup over 3 months</label>
        </div>
        {editable && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button disabled={pending} onClick={() => start(async () => { const r = await saveQuote(p.id, { lines, termMonths: term, discountPct: discount, splitSetup: split }); setMsg(r.message); })} className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Save draft"}</button>
            {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
          </div>
        )}
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold text-heading">Totals</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {[
              ["Setup", formatMoney(ev.totals.setup)],
              ["Monthly (after discount)", formatMoney(ev.totals.monthly)],
              ["Usage estimate / month", formatMoney(ev.totals.usageEstimate)],
              [`Contract value (${term} months)`, formatMoney(ev.totals.contractValue)],
              ["Elans delivery cost", formatMoney(ev.totals.cost)],
              ["Gross margin", `${(ev.totals.grossMargin * 100).toFixed(1)}%`],
            ].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
            {split && <div className="flex justify-between"><dt className="text-muted">Setup instalments</dt><dd>{ev.totals.instalments.map((x) => formatMoney(x)).join(" · ")}</dd></div>}
          </dl>
        </section>
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold text-heading">Commercial rule checks</h2>
          <ul className="mt-3 space-y-2">
            {ev.checks.map((c) => (
              <li key={c.key} className={cx("flex gap-2 rounded-lg p-2 text-sm", c.level === "error" ? "bg-danger-bg text-danger" : c.level === "warn" ? "bg-warning-bg text-warning" : "bg-success-bg text-success")}>
                <Icon name={c.level === "ok" ? "check" : "alert"} size={16} className="mt-0.5 shrink-0" />
                <span><strong>{c.label}:</strong> {c.detail}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold text-heading">Send</h2>
          {p.status === "draft" ? (
            <form action={sendQuote.bind(null, p.id)} className="mt-3 space-y-2">
              <label className="block text-sm"><span className="mb-1 block text-muted">Client email</span><input name="email" type="email" defaultValue={p.clientEmail} className={cell} /></label>
              <button disabled={!ev.canSend} className="w-full rounded-lg bg-brown py-2 text-sm font-semibold text-white disabled:opacity-50">Send proposal (save first)</button>
              {!ev.canSend && <p className="text-xs text-danger">Fix the red checks before sending.</p>}
            </form>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p>Status: <strong>{p.status}</strong>{p.acceptedBy ? ` · accepted by ${p.acceptedBy}` : ""}</p>
              {p.publicUrl && <a href={p.publicUrl} target="_blank" className="text-copper-ink underline">Open client proposal page</a>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
