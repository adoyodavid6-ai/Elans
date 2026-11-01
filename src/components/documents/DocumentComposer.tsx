"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DocumentView } from "./DocumentView";
import { saveDocument, issueDocument } from "@/app/ops/document-actions";
import { addMonths, computeTotals, formatAmount } from "@/lib/documents/compute";
import { emptyLine, type DocClient, type DocData, type DocKind, type DocTemplateConfig } from "@/lib/documents/types";

const input = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm focus:border-brown focus:outline-none";
type Tpl = { id: string; name: string; is_default: boolean; config: DocTemplateConfig };

export function DocumentComposer({ id, kind, templates, initial }: {
  id: string | null;
  kind: DocKind;
  templates: Tpl[];
  initial: { templateId: string; title: string; client: DocClient; data: DocData; sourceRef: string | null };
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(initial.templateId);
  const [title, setTitle] = useState(initial.title);
  const [client, setClient] = useState(initial.client);
  const [data, setData] = useState(initial.data);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const tpl = templates.find((t) => t.id === templateId) ?? templates[0];
  const cfg = tpl.config;
  const totals = useMemo(() => computeTotals(kind, data, cfg), [kind, data, cfg]);
  const sigLabels = cfg.sections.find((s) => s.type === "signatures" && s.visible)?.signatories ?? [];

  const c = (k: keyof DocClient, label: string, type = "text") => (
    <label className="block text-sm"><span className="mb-1 block font-medium text-heading">{label}</span><input className={input} type={type} value={client[k]} onChange={(e) => setClient({ ...client, [k]: e.target.value })} /></label>
  );
  const d = <K extends keyof DocData>(k: K, label: string, type = "text", hint?: string) => (
    <label className="block text-sm"><span className="mb-1 block font-medium text-heading">{label}</span>
      <input className={input} type={type} value={String(data[k] ?? "")} onChange={(e) => setData({ ...data, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
  const setLine = (i: number, patch: Partial<DocData["lines"][number]>) => setData({ ...data, lines: data.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const payload = () => ({ kind, templateId, title, sourceRef: initial.sourceRef, client, data: { ...data, signatories: sigLabels.map((s, i) => ({ label: s.label, name: data.signatories[i]?.name ?? "", title: data.signatories[i]?.title ?? "" })) } });
  const save = (thenIssue = false) => start(async () => {
    const r = await saveDocument(id, payload());
    setMsg(r);
    if (!r.ok || !r.id) return;
    if (thenIssue) await issueDocument(r.id);
    if (!id || thenIssue) router.push(`/ops/documents/${r.id}`);
    router.refresh();
  });

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,34rem)_1fr]">
      <form className="min-w-0 space-y-4" onSubmit={(e) => { e.preventDefault(); save(false); }}>
        <Panel title="Template">
          <label className="block text-sm"><span className="mb-1 block font-medium text-heading">Use template</span>
            <select className={input} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_default ? " (default)" : ""}</option>)}</select>
          </label>
          <label className="mt-3 block text-sm"><span className="mb-1 block font-medium text-heading">Internal title</span><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the client's name" /></label>
        </Panel>

        <Panel title={kind === "receipt" ? "Received from" : "Client"}>
          <div className="grid gap-3 sm:grid-cols-2">{c("organisation", "Organisation")}{c("name", "Contact name")}{c("email", "Email", "email")}{c("phone", "Phone")}<div className="sm:col-span-2">{c("address", "Address")}</div>{c("taxPin", "KRA PIN")}</div>
        </Panel>

        <Panel title="Details">
          <div className="grid gap-3 sm:grid-cols-2">
            {d("date", "Date", "date")}
            {kind === "quotation" && d("secondaryDate", "Valid until", "date")}
            {kind === "contract" && <>{d("startDate", "Start date", "date")}{d("termMonths", "Minimum term (months)", "number", data.startDate && data.termMonths ? `Ends ${addMonths(data.startDate, data.termMonths)}` : undefined)}</>}
            {kind === "receipt" && <>
              {d("amountReceived", "Amount received", "number", `Leave 0 to use the total (${formatAmount(totals.total, cfg.money.currency)})`)}
              <label className="block text-sm"><span className="mb-1 block font-medium text-heading">Payment method</span><select className={input} value={data.method} onChange={(e) => setData({ ...data, method: e.target.value })}>{["M-Pesa", "Bank transfer", "Cash", "Card", "Cheque", "RTGS/EFT"].map((m) => <option key={m}>{m}</option>)}</select></label>
              {d("paymentRef", "Payment reference", "text", "M-Pesa code, bank reference or cheque number")}
              {d("forInvoice", "In payment of", "text", "e.g. invoice ELN-2026-1001")}
            </>}
            {d("reference", "Reference (optional)")}
          </div>
        </Panel>

        <Panel title="Line items">
          <ul className="space-y-3">
            {data.lines.map((l, i) => (
              <li key={i} className="rounded-xl border border-line p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-xs text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input aria-label={`Line ${i + 1} description`} className={input} placeholder="Description" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                    <input aria-label={`Line ${i + 1} details`} className={`${input} text-xs`} placeholder="Details (optional)" value={l.details} onChange={(e) => setLine(i, { details: e.target.value })} />
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs"><span className="mb-0.5 block text-muted">Qty</span><input className={input} type="number" min={0} step="any" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} /></label>
                      <label className="text-xs"><span className="mb-0.5 block text-muted">Unit price</span><input className={input} type="number" min={0} step="any" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} /></label>
                      <label className="text-xs"><span className="mb-0.5 block text-muted">Discount %</span><input className={input} type="number" min={0} max={100} value={l.discountPct} onChange={(e) => setLine(i, { discountPct: Number(e.target.value) })} /></label>
                    </div>
                    {cfg.money.vatEnabled && <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-brown" checked={l.vat} onChange={(e) => setLine(i, { vat: e.target.checked })} /> VAT at {cfg.money.vatRate}%</label>}
                  </div>
                  <span className="flex flex-col gap-1">
                    <button type="button" aria-label={`Move line ${i + 1} up`} disabled={i === 0} onClick={() => { const ls = [...data.lines]; [ls[i - 1], ls[i]] = [ls[i], ls[i - 1]]; setData({ ...data, lines: ls }); }} className="h-7 w-7 rounded-md text-muted hover:bg-surface-2 disabled:opacity-30">↑</button>
                    <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setData({ ...data, lines: data.lines.filter((_, j) => j !== i) })} className="h-7 w-7 rounded-md text-muted hover:bg-surface-2">✕</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setData({ ...data, lines: [...data.lines, { ...emptyLine(), vat: cfg.money.vatEnabled }] })} className="mt-3 text-sm font-semibold text-copper-ink">+ Add line</button>
          <p className="mt-3 text-right text-sm">Total <strong className="tabular-nums">{formatAmount(totals.total, cfg.money.currency)}</strong>{cfg.money.vatEnabled ? <span className="text-muted"> (VAT {formatAmount(totals.vat, cfg.money.currency)})</span> : null}</p>
        </Panel>

        {sigLabels.length > 0 && (
          <Panel title="Signatories (optional)">
            <div className="space-y-3">{sigLabels.map((s, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm"><span className="mb-1 block font-medium">{s.label.replace(/\{\{[^}]+\}\}/g, cfg.company.name)}: name</span><input className={input} value={data.signatories[i]?.name ?? ""} onChange={(e) => { const sg = [...data.signatories]; sg[i] = { label: s.label, title: sg[i]?.title ?? "", name: e.target.value }; setData({ ...data, signatories: sg }); }} /></label>
                <label className="text-sm"><span className="mb-1 block font-medium">Title</span><input className={input} value={data.signatories[i]?.title ?? ""} onChange={(e) => { const sg = [...data.signatories]; sg[i] = { label: s.label, name: sg[i]?.name ?? "", title: e.target.value }; setData({ ...data, signatories: sg }); }} /></label>
              </div>
            ))}</div>
          </Panel>
        )}

        <Panel title="Notes (optional)"><textarea aria-label="Notes" className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm" rows={3} value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} placeholder="Shown at the bottom of the document" /></Panel>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/95 p-3 backdrop-blur">
          <button type="submit" disabled={pending} className="h-10 rounded-lg px-4 text-sm font-semibold ring-1 ring-line hover:bg-surface-2 disabled:opacity-50">{pending ? "Saving…" : "Save draft"}</button>
          <button type="button" disabled={pending} onClick={() => { if (confirm("Issue this document? It gets the next number and can no longer be edited.")) save(true); }} className="h-10 rounded-lg bg-brown px-4 text-sm font-semibold text-white disabled:opacity-50">Save &amp; issue</button>
          {msg && <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.message}</p>}
        </div>
      </form>

      <div className="min-w-0">
        <div className="sticky top-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Preview</p>
          <div className="overflow-auto rounded-2xl bg-surface-2 p-4" style={{ maxHeight: "calc(100vh - 8rem)" }} tabIndex={0} role="region" aria-label="Document preview">
            <DocumentView kind={kind} cfg={cfg} client={client} data={data} number={null} status="draft" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-surface p-4"><h2 className="mb-3 text-sm font-semibold text-heading">{title}</h2>{children}</section>;
}
