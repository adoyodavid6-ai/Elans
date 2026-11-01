import type { DocClient, DocData, DocKind, DocLine, DocTemplateConfig, DocTotals } from "./types";

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/** Line maths. Prices can be entered VAT-inclusive or exclusive (per template). */
export function lineAmounts(l: DocLine, cfg: DocTemplateConfig) {
  const gross = r2(Math.max(0, l.qty) * Math.max(0, l.unitPrice));
  const discount = r2((gross * Math.min(100, Math.max(0, l.discountPct))) / 100);
  const afterDiscount = gross - discount;
  const rate = cfg.money.vatEnabled && l.vat ? cfg.money.vatRate / 100 : 0;
  const net = cfg.money.pricesIncludeVat && rate ? r2(afterDiscount / (1 + rate)) : r2(afterDiscount);
  const vat = cfg.money.pricesIncludeVat ? r2(afterDiscount - net) : r2(net * rate);
  return { gross, discount, net, vat, total: r2(net + vat) };
}

export function computeTotals(kind: DocKind, data: DocData, cfg: DocTemplateConfig): DocTotals {
  const rows = data.lines.filter((l) => l.description.trim() || l.unitPrice).map((l) => lineAmounts(l, cfg));
  const subtotal = r2(rows.reduce((s, x) => s + x.gross, 0));
  const discount = r2(rows.reduce((s, x) => s + x.discount, 0));
  const net = r2(rows.reduce((s, x) => s + x.net, 0));
  const vat = r2(rows.reduce((s, x) => s + x.vat, 0));
  const total = r2(net + vat);
  const received = kind === "receipt" ? r2(data.amountReceived || total) : 0;
  return { subtotal, discount, net, vat, total, received, balance: kind === "receipt" ? r2(Math.max(0, total - received)) : 0 };
}

export function formatAmount(n: number, currency: string) {
  return `${currency} ${r2(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(d: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || "";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function addMonths(d: string, months: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !months) return "";
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + months);
  x.setUTCDate(x.getUTCDate() - 1);
  return x.toISOString().slice(0, 10);
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function words999(n: number): string {
  const h = Math.floor(n / 100), rest = n % 100;
  const t = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ""}`;
  return [h ? `${ONES[h]} hundred` : "", h && rest ? "and" : "", t].filter(Boolean).join(" ");
}
/** "KES 12,500.50" → "Twelve thousand five hundred shillings and fifty cents" (UK English). */
export function amountInWords(n: number, currency = "KES") {
  const v = Math.round(Math.max(0, n) * 100);
  let whole = Math.floor(v / 100);
  const cents = v % 100;
  if (whole > 999_999_999_999) return "";
  const parts: string[] = [];
  for (const [size, name] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]] as const) {
    if (whole >= size) { parts.push(`${words999(Math.floor(whole / size))} ${name}`); whole %= size; }
  }
  if (whole) parts.push((parts.length && whole < 100 ? "and " : "") + words999(whole));
  const unit = currency === "KES" ? ["shilling", "shillings", "cents"] : currency === "USD" ? ["dollar", "dollars", "cents"] : [currency, currency, "cents"];
  const main = parts.length ? parts.join(" ") : "zero";
  const s = `${main} ${Math.floor(v / 100) === 1 ? unit[0] : unit[1]}${cents ? ` and ${words999(cents)} ${unit[2]}` : ""}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface MergeContext {
  kind: DocKind;
  number: string | null;
  client: DocClient;
  data: DocData;
  totals: DocTotals;
  cfg: DocTemplateConfig;
}

/** The fill-in fields available in text blocks, with labels for the editor's "insert field" list. */
export function mergeFields(ctx: MergeContext): Record<string, { label: string; value: string }> {
  const { cfg, client, data, totals } = ctx;
  const cur = cfg.money.currency;
  const f: Record<string, { label: string; value: string }> = {
    "company.name": { label: "Your company name", value: cfg.company.name },
    "company.address": { label: "Your address", value: cfg.company.address },
    "company.email": { label: "Your email", value: cfg.company.email },
    "company.phone": { label: "Your phone", value: cfg.company.phone },
    "company.taxPin": { label: "Your KRA PIN", value: cfg.company.taxPin },
    "client.name": { label: "Client contact name", value: client.name },
    "client.organisation": { label: "Client organisation", value: client.organisation },
    "client.email": { label: "Client email", value: client.email },
    "client.phone": { label: "Client phone", value: client.phone },
    "client.address": { label: "Client address", value: client.address },
    "client.taxPin": { label: "Client KRA PIN", value: client.taxPin },
    "doc.number": { label: "Document number", value: ctx.number ?? "(assigned when issued)" },
    "doc.date": { label: "Document date", value: formatDate(data.date) },
    "doc.reference": { label: "Reference", value: data.reference },
    "doc.subtotal": { label: "Subtotal", value: formatAmount(totals.subtotal, cur) },
    "doc.vat": { label: "VAT amount", value: formatAmount(totals.vat, cur) },
    "doc.total": { label: "Total", value: formatAmount(totals.total, cur) },
    "doc.totalInWords": { label: "Total in words", value: amountInWords(totals.total, cur) },
    "vat.rate": { label: "VAT rate", value: `${cfg.money.vatRate}%` },
    "payment.mpesaPaybill": { label: "M-Pesa paybill", value: cfg.payment.mpesaPaybill },
    "payment.mpesaAccount": { label: "M-Pesa account", value: cfg.payment.mpesaAccount },
    "payment.bankAccountNumber": { label: "Bank account number", value: cfg.payment.bankAccountNumber },
  };
  if (ctx.kind === "quotation") {
    f["quote.validUntil"] = { label: "Valid until", value: formatDate(data.secondaryDate) };
    f["quote.validityDays"] = { label: "Validity (days)", value: String(cfg.validityDays) };
  }
  if (ctx.kind === "contract") {
    f["contract.startDate"] = { label: "Start date", value: formatDate(data.startDate) };
    f["contract.termMonths"] = { label: "Term (months)", value: data.termMonths ? String(data.termMonths) : "" };
    f["contract.endDate"] = { label: "End date", value: formatDate(data.secondaryDate || addMonths(data.startDate, data.termMonths)) };
  }
  if (ctx.kind === "receipt") {
    f["receipt.amount"] = { label: "Amount received", value: formatAmount(totals.received, cur) };
    f["receipt.amountInWords"] = { label: "Amount received in words", value: amountInWords(totals.received, cur) };
    f["receipt.method"] = { label: "Payment method", value: data.method };
    f["receipt.reference"] = { label: "Payment reference", value: data.paymentRef };
    f["receipt.forInvoice"] = { label: "For invoice", value: data.forInvoice };
    f["receipt.balance"] = { label: "Balance due", value: formatAmount(totals.balance, cur) };
  }
  return f;
}

/** Replaces {{field}} tokens. Unknown or empty fields become a blank line (preview marks them). */
export function fillFields(text: string, fields: Record<string, { value: string }>, mark = false) {
  return text.replace(/\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}/g, (_, k: string) => {
    const v = fields[k]?.value;
    if (v) return v;
    return mark ? `⟨${k}⟩` : "__________";
  });
}

/** Display number from the template's numbering scheme, e.g. QUO-2026-0007. */
export function formatNumber(cfg: DocTemplateConfig, seq: number, year: number) {
  return [cfg.numbering.prefix, cfg.numbering.includeYear ? String(year) : "", String(seq).padStart(Math.max(1, Math.min(8, cfg.numbering.pad)), "0")].filter(Boolean).join("-");
}
