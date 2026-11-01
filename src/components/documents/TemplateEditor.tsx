"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { DocumentView } from "./DocumentView";
import { saveTemplate } from "@/app/ops/document-actions";
import { computeTotals, mergeFields } from "@/lib/documents/compute";
import { SECTION_TYPES, type DocKind, type DocTemplateConfig, type Section, type SectionType } from "@/lib/documents/types";
import { sampleFor } from "@/lib/documents/sample";
import { Icon } from "@/components/ui/Icon";

const input = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm focus:border-brown focus:outline-none";
const TABS = [
  { key: "sections", label: "Layout & sections" },
  { key: "branding", label: "Branding" },
  { key: "company", label: "Company" },
  { key: "payment", label: "Payment" },
  { key: "numbering", label: "Numbering & tax" },
  { key: "labels", label: "Labels & footer" },
] as const;

function contrast(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (l + 0.05); // against white text
}

export function TemplateEditor({ id, kind, initialName, initial, canEdit }: { id: string; kind: DocKind; initialName: string; initial: DocTemplateConfig; canEdit: boolean }) {
  const [cfg, setCfg] = useState<DocTemplateConfig>(initial);
  const [name, setName] = useState(initialName);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("sections");
  const [open, setOpen] = useState<string | null>(initial.sections[1]?.id ?? null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const sample = useMemo(() => sampleFor(kind, cfg), [kind, cfg]);
  const fields = useMemo(() => mergeFields({ kind, number: null, ...sample, totals: computeTotals(kind, sample.data, cfg), cfg }), [kind, sample, cfg]);
  const areas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const update = (fn: (c: DocTemplateConfig) => DocTemplateConfig) => { setCfg((c) => fn(structuredClone(c))); setDirty(true); setStatus(null); };
  const set = <K extends keyof DocTemplateConfig>(k: K, sub: string, v: unknown) => update((c) => { (c[k] as Record<string, unknown>)[sub] = v; return c; });
  const setSection = (sid: string, patch: Partial<Section>) => update((c) => { c.sections = c.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)); return c; });
  const move = (i: number, d: -1 | 1) => update((c) => { const j = i + d; if (j < 0 || j >= c.sections.length) return c; [c.sections[i], c.sections[j]] = [c.sections[j], c.sections[i]]; return c; });
  const addSection = (type: SectionType) => {
    const s: Section = { id: `s${Date.now().toString(36)}`, type, title: type === "text" ? "New section" : type === "terms" ? "Terms" : type === "signatures" ? "Signatures" : type === "payment" ? "Payment details" : "", body: type === "terms" ? "First clause.\n\nSecond clause." : "", visible: true, ...(type === "signatures" ? { signatories: [{ label: "For the client" }, { label: "For {{company.name}}" }] } : {}) };
    update((c) => { c.sections.push(s); return c; });
    setOpen(s.id);
  };
  const insertField = (sid: string, key: string) => {
    const el = areas.current[sid];
    const s = cfg.sections.find((x) => x.id === sid);
    if (!s) return;
    const token = `{{${key}}}`;
    const pos = el ? el.selectionStart : s.body.length;
    setSection(sid, { body: s.body.slice(0, pos) + token + s.body.slice(pos) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + token.length, pos + token.length); });
  };
  const save = () => start(async () => { const r = await saveTemplate(id, name, cfg); setStatus(r); if (r.ok) setDirty(false); });

  const txt = (k: keyof DocTemplateConfig, sub: string, label: string, opts: { placeholder?: string; type?: string; hint?: string } = {}) => (
    <label className="block text-sm"><span className="mb-1 block font-medium text-heading">{label}</span>
      <input className={input} type={opts.type ?? "text"} disabled={!canEdit} placeholder={opts.placeholder} value={String((cfg[k] as Record<string, unknown>)[sub] ?? "")} onChange={(e) => set(k, sub, opts.type === "number" ? Number(e.target.value) : e.target.value)} />
      {opts.hint && <span className="mt-1 block text-xs text-muted">{opts.hint}</span>}
    </label>
  );
  const toggle = (k: keyof DocTemplateConfig, sub: string, label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brown" disabled={!canEdit} checked={Boolean((cfg[k] as Record<string, unknown>)[sub])} onChange={(e) => set(k, sub, e.target.checked)} />{label}</label>
  );

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,34rem)_1fr]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
          <label className="min-w-0 flex-1 text-sm"><span className="mb-1 block font-medium text-heading">Template name</span><input className={input} value={name} disabled={!canEdit} onChange={(e) => { setName(e.target.value); setDirty(true); }} /></label>
          {canEdit && <button type="button" onClick={save} disabled={pending || !dirty} className="h-9 rounded-lg bg-brown px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : dirty ? "Save template" : "Saved"}</button>}
          {status && <p role="status" className={`basis-full text-sm ${status.ok ? "text-success" : "text-danger"}`}>{status.message}</p>}
          {!canEdit && <p className="basis-full text-xs text-muted">View only: admins and consultants can edit templates.</p>}
        </div>

        <div role="tablist" aria-label="Template settings" className="flex flex-wrap gap-1">
          {TABS.map((t) => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-brown text-white" : "bg-surface-2 text-heading hover:bg-sand"}`}>{t.label}</button>)}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4" role="tabpanel">
          {tab === "sections" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">Sections print in this order. Use the arrows to reorder, the eye to hide without deleting. Text supports **bold**, *italic*, lists and fill-in fields like {"{{client.organisation}}"}.</p>
              <ul className="space-y-2">
                {cfg.sections.map((s, i) => {
                  const meta = SECTION_TYPES.find((t) => t.key === s.type)!;
                  const isOpen = open === s.id;
                  return (
                    <li key={s.id} className={`rounded-xl border ${isOpen ? "border-brown/40 bg-wine-50" : "border-line"} ${s.visible ? "" : "opacity-60"}`}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-semibold text-heading">{s.title ? s.title.replace(/\{\{[^}]+\}\}/g, "…") : meta.label}</span>
                          <span className="block text-xs text-muted">{meta.label}{!s.visible ? " · hidden" : ""}</span>
                        </button>
                        {canEdit && (
                          <span className="flex shrink-0 items-center gap-0.5">
                            <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</IconBtn>
                            <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === cfg.sections.length - 1}>↓</IconBtn>
                            <IconBtn label={s.visible ? "Hide section" : "Show section"} onClick={() => setSection(s.id, { visible: !s.visible })}><Icon name={s.visible ? "eye" : "x"} size={14} /></IconBtn>
                            <IconBtn label="Delete section" onClick={() => { if (confirm(`Delete "${s.title || meta.label}"?`)) update((c) => { c.sections = c.sections.filter((x) => x.id !== s.id); return c; }); }}>🗑</IconBtn>
                          </span>
                        )}
                      </div>
                      {isOpen && (
                        <div className="space-y-3 border-t border-line px-3 py-3">
                          <p className="text-xs text-muted">{meta.help}</p>
                          {s.type !== "parties" && s.type !== "divider" && (
                            <label className="block text-sm"><span className="mb-1 block font-medium">Heading</span><input className={input} disabled={!canEdit} value={s.title} onChange={(e) => setSection(s.id, { title: e.target.value })} placeholder="(no heading)" /></label>
                          )}
                          {(s.type === "text" || s.type === "terms") && (
                            <div>
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                <label htmlFor={`body-${s.id}`} className="text-sm font-medium">{s.type === "terms" ? "Clauses (leave a blank line between clauses)" : "Text"}</label>
                                {canEdit && (
                                  <select aria-label="Insert a fill-in field" className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" value="" onChange={(e) => e.target.value && insertField(s.id, e.target.value)}>
                                    <option value="">+ Insert field…</option>
                                    {Object.entries(fields).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                                  </select>
                                )}
                              </div>
                              <textarea id={`body-${s.id}`} ref={(el) => { areas.current[s.id] = el; }} disabled={!canEdit} value={s.body} onChange={(e) => setSection(s.id, { body: e.target.value })} rows={s.type === "terms" ? 12 : 6} className="w-full rounded-lg border border-line bg-surface p-2.5 font-mono text-[0.8rem] leading-relaxed focus:border-brown focus:outline-none" />
                            </div>
                          )}
                          {s.type === "signatures" && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Signature lines</p>
                              {(s.signatories ?? []).map((sg, j) => (
                                <div key={j} className="flex gap-2">
                                  <input aria-label={`Signature line ${j + 1} label`} className={input} disabled={!canEdit} value={sg.label} onChange={(e) => setSection(s.id, { signatories: (s.signatories ?? []).map((x, k) => (k === j ? { label: e.target.value } : x)) })} />
                                  {canEdit && <IconBtn label="Remove signature line" onClick={() => setSection(s.id, { signatories: (s.signatories ?? []).filter((_, k) => k !== j) })}>✕</IconBtn>}
                                </div>
                              ))}
                              {canEdit && (s.signatories?.length ?? 0) < 4 && <button type="button" className="text-sm font-semibold text-copper-ink" onClick={() => setSection(s.id, { signatories: [...(s.signatories ?? []), { label: "Witness" }] })}>+ Add signature line</button>}
                            </div>
                          )}
                          {s.type === "payment" && <p className="text-xs text-muted">Shows the details from the Payment tab; empty fields are left out.</p>}
                          {s.type === "lineItems" && <p className="text-xs text-muted">Discount and VAT columns appear automatically when used. VAT settings are in the Numbering &amp; tax tab.</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {canEdit && (
                <label className="mt-2 flex items-center gap-2 text-sm"><span className="font-medium">Add a section:</span>
                  <select className="h-9 flex-1 rounded-lg border border-line bg-surface px-2 text-sm" value="" onChange={(e) => e.target.value && addSection(e.target.value as SectionType)}>
                    <option value="">Choose…</option>{SECTION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </label>
              )}
              {kind === "contract" && <p className="mt-3 rounded-lg bg-warning-bg p-2.5 text-xs text-warning">The standard contract wording is a starting skeleton, not legal advice. Have your advocate review it before using it with clients.</p>}
            </div>
          )}

          {tab === "branding" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm"><span className="mb-1 block font-medium">Main colour</span><span className="flex gap-2"><input type="color" aria-label="Main colour picker" disabled={!canEdit} value={cfg.branding.accent} onChange={(e) => set("branding", "accent", e.target.value)} className="h-9 w-12 rounded border border-line" /><input className={input} disabled={!canEdit} value={cfg.branding.accent} onChange={(e) => set("branding", "accent", e.target.value)} /></span></label>
              <label className="block text-sm"><span className="mb-1 block font-medium">Second colour (top line blend)</span><span className="flex gap-2"><input type="color" aria-label="Second colour picker" disabled={!canEdit} value={cfg.branding.accent2} onChange={(e) => set("branding", "accent2", e.target.value)} className="h-9 w-12 rounded border border-line" /><input className={input} disabled={!canEdit} value={cfg.branding.accent2} onChange={(e) => set("branding", "accent2", e.target.value)} /></span></label>
              {contrast(cfg.branding.accent) < 4.5 && <p className="sm:col-span-2 rounded-lg bg-warning-bg p-2 text-xs text-warning">This main colour is light: white text on it (table headings, band header) may be hard to read. Contrast {contrast(cfg.branding.accent).toFixed(1)}:1; aim for 4.5:1 or more.</p>}
              <label className="block text-sm"><span className="mb-1 block font-medium">Header style</span><select className={input} disabled={!canEdit} value={cfg.branding.headerStyle} onChange={(e) => set("branding", "headerStyle", e.target.value)}><option value="split">Logo left, title right</option><option value="stacked">Centred</option><option value="band">Coloured band</option></select></label>
              <label className="block text-sm"><span className="mb-1 block font-medium">Typeface</span><select className={input} disabled={!canEdit} value={cfg.branding.font} onChange={(e) => set("branding", "font", e.target.value)}><option value="sans">Modern (Plus Jakarta Sans)</option><option value="serif">Classic serif (Georgia)</option></select></label>
              <label className="block text-sm"><span className="mb-1 block font-medium">Paper size</span><select className={input} disabled={!canEdit} value={cfg.branding.paper} onChange={(e) => set("branding", "paper", e.target.value)}><option value="A4">A4</option><option value="Letter">US Letter</option></select></label>
              {txt("branding", "logoText", "Logo initials", { hint: "1–2 letters shown in the logo tile." })}
              <div className="space-y-2 sm:col-span-2">{toggle("branding", "showLogo", "Show logo tile")}{toggle("branding", "blendLine", "Show colour line across the top")}</div>
              <label className="block text-sm sm:col-span-2"><span className="mb-1 block font-medium">Document title</span><input className={input} disabled={!canEdit} value={cfg.title} onChange={(e) => update((c) => { c.title = e.target.value; return c; })} /></label>
            </div>
          )}

          {tab === "company" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {txt("company", "name", "Company name")}{txt("company", "tagline", "Tagline")}
              <div className="sm:col-span-2">{txt("company", "address", "Address")}</div>
              {txt("company", "email", "Email")}{txt("company", "phone", "Phone")}{txt("company", "website", "Website")}{txt("company", "taxPin", "KRA PIN")}{txt("company", "registrationNo", "Registration number")}
              <p className="sm:col-span-2 text-xs text-muted">Empty fields are left off the document.</p>
            </div>
          )}

          {tab === "payment" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {txt("payment", "mpesaPaybill", "M-Pesa paybill")}{txt("payment", "mpesaAccount", "M-Pesa account number", { hint: "e.g. your company name or 'invoice number'" })}{txt("payment", "mpesaTill", "M-Pesa till (Buy Goods)")}
              {txt("payment", "bankName", "Bank")}{txt("payment", "bankBranch", "Branch")}{txt("payment", "bankAccountName", "Account name")}{txt("payment", "bankAccountNumber", "Account number")}{txt("payment", "swift", "SWIFT code")}
              <label className="block text-sm sm:col-span-2"><span className="mb-1 block font-medium">Payment instructions</span><textarea className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm" rows={3} disabled={!canEdit} value={cfg.payment.instructions} onChange={(e) => set("payment", "instructions", e.target.value)} /></label>
            </div>
          )}

          {tab === "numbering" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {txt("numbering", "prefix", "Number prefix", { hint: "e.g. QUO, INV/ELN" })}
              {txt("numbering", "pad", "Digits", { type: "number", hint: "4 → 0007" })}
              <div className="sm:col-span-2">{toggle("numbering", "includeYear", "Include the year (QUO-2026-0007)")}</div>
              {txt("money", "currency", "Currency code", { hint: "KES, USD, UGX…" })}
              {kind === "quotation" && <label className="block text-sm"><span className="mb-1 block font-medium">Valid for (days)</span><input className={input} type="number" min={0} disabled={!canEdit} value={cfg.validityDays} onChange={(e) => update((c) => { c.validityDays = Number(e.target.value); return c; })} /></label>}
              <div className="space-y-2 sm:col-span-2">{toggle("money", "vatEnabled", "Charge VAT")}{cfg.money.vatEnabled && toggle("money", "pricesIncludeVat", "Prices I enter already include VAT")}</div>
              {cfg.money.vatEnabled && txt("money", "vatRate", "VAT rate (%)", { type: "number", hint: "Confirm the current statutory rate with your tax adviser." })}
            </div>
          )}

          {tab === "labels" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {txt("labels", "from", "'From' heading")}{txt("labels", "to", "'To' heading")}{txt("labels", "number", "Number label")}{txt("labels", "date", "Date label")}{txt("labels", "secondaryDate", "Second date label", { hint: kind === "quotation" ? "e.g. Valid until" : kind === "contract" ? "e.g. End date" : "Leave empty to hide" })}
              <label className="block text-sm sm:col-span-2"><span className="mb-1 block font-medium">Footer</span><input className={input} disabled={!canEdit} value={cfg.footer} onChange={(e) => update((c) => { c.footer = e.target.value; return c; })} /><span className="mt-1 block text-xs text-muted">Supports fill-in fields, e.g. {"{{company.name}} · KRA PIN {{company.taxPin}}"}</span></label>
            </div>
          )}
        </div>
        {dirty && canEdit && <p className="text-xs text-warning">You have unsaved changes.</p>}
      </div>

      <div className="min-w-0">
        <div className="sticky top-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Live preview (sample client) · fields shown as ⟨…⟩ are empty</p>
          <div className="overflow-auto rounded-2xl bg-surface-2 p-4" style={{ maxHeight: "calc(100vh - 8rem)" }} tabIndex={0} role="region" aria-label="Document preview">
            <DocumentView kind={kind} cfg={cfg} client={sample.client} data={sample.data} number={null} status="preview" markFields />
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid h-7 w-7 place-items-center rounded-md text-sm text-muted hover:bg-surface-2 hover:text-heading disabled:opacity-30">{children}</button>;
}
