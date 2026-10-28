import { z } from "zod";

/** Field extraction for purchase invoices. Rules for text; model vision for images/PDFs (via the AI gateway). */
export interface Extracted {
  supplierName: string | null;
  supplierPin: string | null;
  buyerPin: string | null;
  invoiceNo: string | null;
  cuInvoiceNo: string | null;
  invoiceDate: string | null;
  amountTotal: number | null;
  vatAmount: number | null;
}
export type Confidence = Record<keyof Extracted, number>;
export const FIELDS: (keyof Extracted)[] = ["supplierName", "supplierPin", "buyerPin", "invoiceNo", "cuInvoiceNo", "invoiceDate", "amountTotal", "vatAmount"];
export const FIELD_LABELS: Record<keyof Extracted, string> = {
  supplierName: "Supplier name",
  supplierPin: "Supplier PIN",
  buyerPin: "Buyer PIN",
  invoiceNo: "Invoice number",
  cuInvoiceNo: "CU invoice number",
  invoiceDate: "Invoice date",
  amountTotal: "Total (incl. VAT)",
  vatAmount: "VAT amount",
};

export const extractionSchema = z.object({
  supplierName: z.string().nullable(),
  supplierPin: z.string().nullable().describe("KRA PIN of the supplier, format letter + 9 digits + letter, e.g. P051234567A"),
  buyerPin: z.string().nullable(),
  invoiceNo: z.string().nullable(),
  cuInvoiceNo: z.string().nullable().describe("Control Unit / eTIMS invoice number if printed"),
  invoiceDate: z.string().nullable().describe("YYYY-MM-DD"),
  amountTotal: z.number().nullable().describe("Total including VAT"),
  vatAmount: z.number().nullable(),
  confidence: z.object({ supplierName: z.number(), supplierPin: z.number(), buyerPin: z.number(), invoiceNo: z.number(), cuInvoiceNo: z.number(), invoiceDate: z.number(), amountTotal: z.number(), vatAmount: z.number() }).describe("0–1 per field; lower if unclear, partly hidden or inferred"),
});

const PIN = /\b([AP]\d{9}[A-Z])\b/gi;
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const num = (s: string) => Number(s.replace(/,/g, ""));

function parseDate(text: string): { value: string | null; conf: number } {
  let m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return { value: `${m[1]}-${m[2]}-${m[3]}`, conf: 0.97 };
  m = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
  if (m) return { value: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, conf: 0.9 };
  m = text.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i);
  if (m) return { value: `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`, conf: 0.9 };
  return { value: null, conf: 0 };
}

/** Deterministic extractor for text invoices. Confidence reflects how explicit each label was. */
export function extractFromText(raw: string): { fields: Extracted; confidence: Confidence } {
  const text = raw.replace(/\r/g, "");
  const lower = text.toLowerCase();
  const pins = [...text.matchAll(PIN)].map((x) => x[1].toUpperCase());
  const buyerMatch = text.match(/(?:buyer|customer)[^\n]*?([AP]\d{9}[A-Z])/i) ?? text.match(/bill to[^\n]*?([AP]\d{9}[A-Z])/i);
  const buyerPin = buyerMatch ? buyerMatch[1].toUpperCase() : null;
  const supplierPin = pins.find((p) => p !== buyerPin) ?? null;
  const invoiceNo = text.match(/(?:invoice\s*(?:no\.?|number|#)?|inv\s*#?)\s*[:\-]?\s*([A-Z]{2,4}-?\d{3,})/i)?.[1]?.toUpperCase() ?? null;
  const cu = text.match(/(?:cu\s*invoice\s*no|control\s*unit\s*invoice\s*number|cuin|cu\s*no)\s*[:\-]?\s*([A-Z0-9]{10,})/i)?.[1]?.toUpperCase() ?? null;
  const date = parseDate(text);
  const total =
    text.match(/total\s*kes\s*:?\s*([\d,]+\.\d{2})/i)?.[1] ??
    text.match(/amount\s*incl\.?\s*vat\s*([\d,]+\.\d{2})/i)?.[1] ??
    text.match(/\bgross\s*([\d,]+\.\d{2})/i)?.[1] ??
    text.match(/(?<!sub)\btotal\b[^\d\n]*([\d,]+\.\d{2})/i)?.[1] ??
    null;
  const vat = text.match(/(?<!(?:excl|incl)\.?\s{0,3})\bvat\b(?:\s*16%)?\s*[:\-]?\s*([\d,]+\.\d{2})/i)?.[1] ?? null;
  const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  const supplierName = firstLine.replace(/^tax invoice\s*\|\s*/i, "").replace(/\s*\.\.\..*$/, "").trim() || null;
  const messy = lower === text; // all-lowercase layouts are harder
  return {
    fields: {
      supplierName: supplierName ? supplierName.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
      supplierPin,
      buyerPin,
      invoiceNo,
      cuInvoiceNo: cu,
      invoiceDate: date.value,
      amountTotal: total ? num(total) : null,
      vatAmount: vat ? num(vat) : null,
    },
    confidence: {
      supplierName: supplierName ? (messy ? 0.7 : 0.88) : 0,
      supplierPin: supplierPin ? (pins.length >= 1 ? 0.96 : 0.6) : 0,
      buyerPin: buyerPin ? 0.93 : 0,
      invoiceNo: invoiceNo ? (messy ? 0.82 : 0.95) : 0,
      cuInvoiceNo: cu ? (messy ? 0.86 : 0.97) : 0,
      invoiceDate: date.conf * (messy ? 0.95 : 1),
      amountTotal: total ? (messy ? 0.88 : 0.96) : 0,
      vatAmount: vat ? 0.9 : 0,
    },
  };
}

/** Deterministic validation rules applied after extraction. */
export function validate(f: Extracted, ctx: { buyerPin: string; period: string }): string[] {
  const flags: string[] = [];
  if (!f.supplierPin) flags.push("Supplier PIN missing");
  else if (!/^[AP]\d{9}[A-Z]$/.test(f.supplierPin)) flags.push("Supplier PIN format invalid");
  if (!f.cuInvoiceNo) flags.push("No CU invoice number printed: likely not issued through eTIMS");
  if (f.buyerPin && f.buyerPin !== ctx.buyerPin) flags.push(`Issued to buyer PIN ${f.buyerPin}, not your PIN ${ctx.buyerPin}`);
  if (f.amountTotal !== null && f.vatAmount !== null) {
    const expectedVat = (f.amountTotal * 16) / 116;
    if (Math.abs(expectedVat - f.vatAmount) > Math.max(2, f.amountTotal * 0.002)) flags.push("VAT does not equal 16/116 of the total");
  }
  if (f.invoiceDate && !f.invoiceDate.startsWith(ctx.period)) flags.push(`Dated ${f.invoiceDate}, outside the period ${ctx.period}`);
  if (f.amountTotal === null) flags.push("Total not found");
  return flags;
}
