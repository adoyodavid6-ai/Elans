import "server-only";
import type { Tx } from "@/lib/db";
import type { QuoteLine } from "@/lib/core/quote";
import { defaultData } from "./defaults";
import { emptyClient, type DocClient, type DocData, type DocKind, type DocTemplateConfig } from "./types";

/**
 * Starting point for a new document, optionally pre-filled from an existing record:
 *   quote:<id> (quotation or contract), contract:<id>, invoice:<id> (receipt), doc:<id> (another document), lead:<id> (client details).
 */
export async function prefill(tx: Tx, kind: DocKind, cfg: DocTemplateConfig, from: string | null): Promise<{ client: DocClient; data: DocData; title: string; sourceRef: string | null }> {
  const data = defaultData(kind, cfg);
  let client = emptyClient();
  let title = "";
  const [type, ref] = (from ?? "").split(":");
  if (!ref || !/^[0-9a-f-]{36}$/.test(ref)) return { client, data, title, sourceRef: null };

  const fromQuote = async (quoteId: string) => {
    const [q] = await tx<{ number: string; lines: QuoteLine[]; term_months: number; totals: { discountPct?: number }; name: string | null; email: string | null; phone: string | null; organisation: string | null; opp: string }[]>`
      select q.number, q.lines, q.term_months, q.totals, c.name, c.email, c.phone, c.organisation, o.name as opp
      from quotes q join opportunities o on o.id = q.opportunity_id left join leads l on l.id = o.lead_id left join contacts c on c.id = l.contact_id where q.id = ${quoteId}`;
    if (!q) return null;
    client = { ...emptyClient(), name: q.name ?? "", email: q.email ?? "", phone: q.phone ?? "", organisation: q.organisation ?? "" };
    title = q.opp;
    data.reference = q.number;
    data.termMonths = q.term_months;
    data.lines = q.lines.map((l) => ({
      description: l.description,
      details: l.kind === "monthly" ? `Monthly, for the minimum term of ${q.term_months} months` : l.kind === "usage" ? "Usage estimate per month; billed on actual usage" : l.kind === "setup" ? "One-off setup" : "",
      qty: l.kind === "monthly" ? q.term_months * (l.qty || 1) : l.qty || 1,
      unitPrice: l.amount,
      discountPct: l.kind === "monthly" ? q.totals?.discountPct ?? 0 : 0,
      vat: cfg.money.vatEnabled,
    }));
    return q;
  };

  if (type === "quote") await fromQuote(ref);
  if (type === "contract") {
    const [ct] = await tx<{ quote_id: string | null; start_date: string; min_term_months: number; signed_by: string | null }[]>`select quote_id, start_date::text, min_term_months, signed_by from contracts where id = ${ref}`;
    if (ct?.quote_id) await fromQuote(ct.quote_id);
    if (ct) { data.startDate = ct.start_date; data.termMonths = ct.min_term_months; if (data.signatories[0] && ct.signed_by) data.signatories[0].name = ct.signed_by; }
  }
  if (type === "invoice") {
    const [inv] = await tx<{ tenant_name: string; number: string; amount: number; description: string; status: string }[]>`select tenant_name, number, amount, description, status from ops_invoice_queue() where id = ${ref}`;
    if (inv) {
      client = { ...emptyClient(), organisation: inv.tenant_name };
      title = `${inv.tenant_name}: ${inv.number}`;
      data.lines = [{ description: `Invoice ${inv.number}${inv.description ? `: ${inv.description}` : ""}`, details: "", qty: 1, unitPrice: Number(inv.amount), discountPct: 0, vat: false }];
      data.forInvoice = `invoice ${inv.number}`;
      data.amountReceived = Number(inv.amount);
      data.method = "M-Pesa";
    }
  }
  if (type === "doc") {
    const [src] = await tx<{ client: DocClient; data: DocData; title: string; number: string | null; totals: { total?: number } }[]>`select client, data, title, number, totals from issued_documents where id = ${ref}`;
    if (src) {
      client = src.client;
      title = src.title;
      data.reference = src.number ?? "";
      data.lines = src.data.lines.map((l) => ({ ...l, vat: kind === "receipt" ? false : l.vat }));
      if (kind === "receipt") { data.amountReceived = Number(src.totals.total ?? 0); data.forInvoice = src.number ? `${src.number}` : ""; }
    }
  }
  if (type === "lead") {
    const [c] = await tx<{ name: string | null; email: string | null; phone: string | null; organisation: string | null }[]>`select c.name, c.email, c.phone, c.organisation from leads l join contacts c on c.id = l.contact_id where l.id = ${ref}`;
    if (c) client = { ...emptyClient(), name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "", organisation: c.organisation ?? "" };
  }
  return { client, data, title, sourceRef: from };
}
