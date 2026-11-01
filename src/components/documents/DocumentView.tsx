import type { CSSProperties, ReactNode } from "react";
import { Markdown } from "@/components/ui/Markdown";
import { computeTotals, fillFields, formatAmount, formatDate, lineAmounts, mergeFields, addMonths } from "@/lib/documents/compute";
import type { DocClient, DocData, DocKind, DocTemplateConfig, Section } from "@/lib/documents/types";

export interface DocumentViewProps {
  kind: DocKind;
  cfg: DocTemplateConfig;
  client: DocClient;
  data: DocData;
  number: string | null;
  status?: "draft" | "issued" | "accepted" | "void" | "preview";
  accepted?: { name: string; at: string } | null;
  /** Editor preview: unresolved fields are shown as ⟨field⟩ instead of a blank line. */
  markFields?: boolean;
}

/** Renders a quotation, contract or receipt from its template. Pure (no hooks): used on server and client, on screen and in print. */
export function DocumentView({ kind, cfg, client, data, number, status = "preview", accepted, markFields = false }: DocumentViewProps) {
  const totals = computeTotals(kind, data, cfg);
  const fields = mergeFields({ kind, number, client, data, totals, cfg });
  const fill = (t: string) => fillFields(t, fields, markFields);
  const cur = cfg.money.currency;
  const b = cfg.branding;
  const style = { "--doc-accent": b.accent, "--doc-accent2": b.accent2, fontFamily: b.font === "serif" ? "Georgia, 'Times New Roman', serif" : undefined } as CSSProperties;
  const visibleLines = data.lines.filter((l) => l.description.trim() || l.unitPrice);
  const anyDiscount = visibleLines.some((l) => l.discountPct > 0);
  const showVat = cfg.money.vatEnabled;
  const secondary = kind === "contract" ? data.secondaryDate || addMonths(data.startDate, data.termMonths) : data.secondaryDate;
  const meta: [string, string][] = [
    [cfg.labels.number, number ?? (status === "preview" ? "QUO-…" : "Draft")],
    [cfg.labels.date, formatDate(data.date)],
    ...(cfg.labels.secondaryDate && secondary ? ([[cfg.labels.secondaryDate, formatDate(secondary)]] as [string, string][]) : []),
    ...(data.reference ? ([["Reference", data.reference]] as [string, string][]) : []),
  ];
  if (!number && status === "preview") meta[0][1] = `${cfg.numbering.prefix}-${cfg.numbering.includeYear ? new Date().getFullYear() + "-" : ""}${"0".repeat(Math.max(0, cfg.numbering.pad - 1))}1`;

  const companyLines = [cfg.company.address, cfg.company.email, cfg.company.phone, cfg.company.website, cfg.company.taxPin && `KRA PIN ${cfg.company.taxPin}`, cfg.company.registrationNo && `Reg. no. ${cfg.company.registrationNo}`].filter(Boolean) as string[];
  const clientLines = [client.name && client.organisation ? client.name : "", client.address, client.email, client.phone, client.taxPin && `KRA PIN ${client.taxPin}`].filter(Boolean) as string[];

  const Heading = ({ children }: { children: ReactNode }) => (children ? <h2 className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--doc-accent)" }}>{children}</h2> : null);

  const renderSection = (s: Section): ReactNode => {
    if (!s.visible) return null;
    const title = fill(s.title);
    switch (s.type) {
      case "parties":
        return (
          <div className="grid grid-cols-2 gap-6">
            <div><p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#6b6b6b]">{cfg.labels.from}</p><p className="mt-1 font-semibold">{cfg.company.name}</p>{companyLines.map((l) => <p key={l} className="text-[#4a4a4a]">{l}</p>)}</div>
            <div><p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#6b6b6b]">{cfg.labels.to}</p><p className="mt-1 font-semibold">{client.organisation || client.name || (markFields ? "⟨client⟩" : "")}</p>{clientLines.map((l) => <p key={l} className="text-[#4a4a4a]">{l}</p>)}</div>
          </div>
        );
      case "text":
        if (!s.body.trim() && !title) return null;
        return <div><Heading>{title}</Heading><div className="doc-md"><Markdown source={fill(s.body)} className="" /></div></div>;
      case "terms": {
        const clauses = s.body.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
        if (!clauses.length) return null;
        return <div><Heading>{title}</Heading><ol className="list-decimal space-y-1.5 pl-5">{clauses.map((c, i) => <li key={i} className="doc-md"><Markdown source={fill(c)} className="" /></li>)}</ol></div>;
      }
      case "lineItems":
        return (
          <div>
            <Heading>{title}</Heading>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-wider text-white" style={{ background: "var(--doc-accent)" }}>
                  <th className="px-2 py-1.5 font-semibold">#</th><th className="px-2 py-1.5 font-semibold">Description</th><th className="px-2 py-1.5 text-right font-semibold">Qty</th><th className="px-2 py-1.5 text-right font-semibold">Unit price</th>
                  {anyDiscount && <th className="px-2 py-1.5 text-right font-semibold">Disc.</th>}{showVat && <th className="px-2 py-1.5 text-right font-semibold">VAT</th>}<th className="px-2 py-1.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.length === 0 && <tr><td colSpan={7} className="px-2 py-3 text-center text-[#6b6b6b]">{markFields ? "Add line items to see them here" : "—"}</td></tr>}
                {visibleLines.map((l, i) => {
                  const a = lineAmounts(l, cfg);
                  return (
                    <tr key={i} className="border-b border-[#e7e1e4] align-top">
                      <td className="px-2 py-1.5 text-[#6b6b6b]">{i + 1}</td>
                      <td className="px-2 py-1.5"><p className="font-medium">{l.description}</p>{l.details && <p className="text-[0.78rem] text-[#5c5c5c]">{l.details}</p>}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{l.qty}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatAmount(l.unitPrice, cur)}</td>
                      {anyDiscount && <td className="px-2 py-1.5 text-right tabular-nums">{l.discountPct ? `${l.discountPct}%` : ""}</td>}
                      {showVat && <td className="px-2 py-1.5 text-right">{l.vat ? `${cfg.money.vatRate}%` : "Exempt"}</td>}
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium tabular-nums">{formatAmount(a.gross - a.discount, cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {showVat && <p className="mt-1 text-[0.72rem] text-[#6b6b6b]">Prices {cfg.money.pricesIncludeVat ? "include" : "exclude"} VAT at {cfg.money.vatRate}% where shown.</p>}
          </div>
        );
      case "totals":
        return (
          <div className="ml-auto w-full max-w-[18rem] text-[0.9rem]">
            <Row k="Subtotal" v={formatAmount(totals.subtotal, cur)} />
            {totals.discount > 0 && <Row k="Discount" v={`− ${formatAmount(totals.discount, cur)}`} />}
            {showVat && <Row k={cfg.money.pricesIncludeVat ? `Of which VAT (${cfg.money.vatRate}%)` : `VAT (${cfg.money.vatRate}%)`} v={formatAmount(totals.vat, cur)} />}
            <div className="mt-1 flex justify-between border-t-2 pt-1.5 text-base font-bold" style={{ borderColor: "var(--doc-accent)" }}><span>Total</span><span className="tabular-nums">{formatAmount(totals.total, cur)}</span></div>
            {kind === "receipt" && <><Row k="Amount received" v={formatAmount(totals.received, cur)} bold />{totals.balance > 0 && <Row k="Balance due" v={formatAmount(totals.balance, cur)} />}</>}
          </div>
        );
      case "payment": {
        const p = cfg.payment;
        const rows = [["M-Pesa paybill", p.mpesaPaybill], ["Account number", p.mpesaAccount], ["M-Pesa till", p.mpesaTill], ["Bank", [p.bankName, p.bankBranch].filter(Boolean).join(", ")], ["Account name", p.bankAccountName], ["Account number", p.bankAccountNumber], ["SWIFT", p.swift]].filter(([, v]) => v);
        if (!rows.length && !p.instructions) return markFields ? <div><Heading>{title}</Heading><p className="text-[#6b6b6b]">Add M-Pesa or bank details in the template&apos;s Payment tab.</p></div> : null;
        return (
          <div><Heading>{title}</Heading>
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-0.5">{rows.map(([k, v], i) => <div key={i} className="contents"><dt className="text-[#6b6b6b]">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
            {p.instructions && <p className="mt-2 text-[#4a4a4a]">{fill(p.instructions)}</p>}
          </div>
        );
      }
      case "signatures": {
        const sigs = s.signatories?.length ? s.signatories : [{ label: "Signature" }];
        return (
          <div><Heading>{title}</Heading>
            <div className={`grid gap-8 ${sigs.length > 1 ? "grid-cols-2" : "grid-cols-1 max-w-xs"}`}>
              {sigs.map((sg, i) => {
                const filled = data.signatories[i];
                return (
                  <div key={i}>
                    <div className="h-12 border-b border-[#9a9a9a]" />
                    <p className="mt-1 text-[0.78rem] font-semibold">{fill(sg.label)}</p>
                    <p className="text-[0.78rem] text-[#5c5c5c]">Name: {filled?.name || "______________________"}{filled?.title ? `, ${filled.title}` : ""}</p>
                    <p className="text-[0.78rem] text-[#5c5c5c]">Date: ______________</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      case "divider":
        return <hr className="border-[#e7e1e4]" />;
    }
  };

  return (
    <article className="doc-page relative mx-auto bg-white text-[0.86rem] leading-relaxed text-[#242424]" style={style} data-paper={b.paper}>
      {b.blendLine && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ background: "linear-gradient(90deg, var(--doc-accent2), var(--doc-accent))" }} />}
      {(status === "draft" || status === "void" || status === "preview") && (
        // Decorative watermark as a background image (not text), so readers and checkers ignore it.
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-center bg-no-repeat [background-size:85%]" style={{ backgroundImage: watermark(status === "void" ? "VOID" : status === "draft" ? "DRAFT" : "PREVIEW", status === "void" ? "#a1281f" : b.accent) }} />
      )}
      <header className={b.headerStyle === "band" ? "-mx-[14mm] -mt-[14mm] mb-6 px-[14mm] pb-6 pt-[16mm] text-white" : "mb-6"} style={b.headerStyle === "band" ? { background: "var(--doc-accent)" } : undefined}>
        <div className={b.headerStyle === "stacked" ? "text-center" : "flex flex-wrap items-start justify-between gap-4"}>
          <div className={b.headerStyle === "stacked" ? "flex flex-col items-center" : "flex items-center gap-3"}>
            {b.showLogo && (
              <span className="grid h-11 w-11 place-items-center rounded-xl text-lg font-extrabold" style={b.headerStyle === "band" ? { background: "rgba(255,255,255,0.16)", color: "#fff" } : { background: "var(--doc-accent)", color: "#fff" }}>{(b.logoText || cfg.company.name || "E").slice(0, 2)}</span>
            )}
            <div className={b.headerStyle === "stacked" ? "mt-2" : ""}>
              <p className="text-lg font-extrabold tracking-tight">{cfg.company.name}</p>
              {cfg.company.tagline && <p className={`text-[0.78rem] ${b.headerStyle === "band" ? "text-white/85" : "text-[#5c5c5c]"}`}>{cfg.company.tagline}</p>}
            </div>
          </div>
          <div className={b.headerStyle === "stacked" ? "mt-4" : "text-right"}>
            <p className="text-2xl font-extrabold tracking-[0.08em]" style={b.headerStyle === "band" ? undefined : { color: "var(--doc-accent)" }}>{cfg.title}</p>
            <dl className={`mt-1 text-[0.8rem] ${b.headerStyle === "stacked" ? "inline-grid" : "grid"} grid-cols-[auto_auto] justify-end gap-x-3`}>
              {meta.map(([k, v]) => <div key={k} className="contents"><dt className={b.headerStyle === "band" ? "text-white/80" : "text-[#6b6b6b]"}>{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
            </dl>
          </div>
        </div>
      </header>
      <div className="space-y-6">{cfg.sections.map((s) => <section key={s.id}>{renderSection(s)}</section>)}</div>
      {data.notes && <div className="mt-6 rounded-lg bg-[#f6f4f5] p-3 text-[0.82rem]"><p className="font-semibold">Notes</p><p className="whitespace-pre-line">{fill(data.notes)}</p></div>}
      {accepted && <p className="mt-6 rounded-lg border border-[#1f6f4a] bg-[#e3f2ea] p-3 text-[0.82rem] text-[#1f6f4a]">Accepted online by <strong>{accepted.name}</strong> on {new Date(accepted.at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Nairobi" })} EAT.</p>}
      {cfg.footer && footerText(cfg.footer, fields, markFields) && <footer className="mt-10 border-t border-[#e7e1e4] pt-3 text-center text-[0.72rem] text-[#6b6b6b]">{footerText(cfg.footer, fields, markFields)}</footer>}
    </article>
  );
}

/** Footer parts are separated by "·"; parts whose fields are empty are dropped instead of printing blanks. */
function footerText(footer: string, fields: Record<string, { value: string }>, mark: boolean) {
  if (mark) return fillFields(footer, fields, true);
  return footer.split("·").map((part) => fillFields(part, fields, false).trim()).filter((p) => p && !p.includes("__________")).join(" · ");
}

function watermark(word: string, colour: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><text x="300" y="300" text-anchor="middle" dominant-baseline="middle" transform="rotate(-30 300 300)" font-family="sans-serif" font-size="120" font-weight="900" letter-spacing="12" fill="${colour}" opacity="0.06">${word}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between py-0.5 ${bold ? "font-semibold" : ""}`}><span className="text-[#4a4a4a]">{k}</span><span className="tabular-nums">{v}</span></div>;
}
