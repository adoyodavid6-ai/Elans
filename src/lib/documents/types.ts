/** Document templates (quotation, contract, receipt): shared by the editor, composer, print and client views. */

export type DocKind = "quotation" | "contract" | "receipt";
export const DOC_KINDS: { key: DocKind; label: string; plural: string }[] = [
  { key: "quotation", label: "Quotation", plural: "Quotations" },
  { key: "contract", label: "Contract", plural: "Contracts" },
  { key: "receipt", label: "Receipt", plural: "Receipts" },
];

export type SectionType = "parties" | "text" | "lineItems" | "totals" | "payment" | "terms" | "signatures" | "divider";
export const SECTION_TYPES: { key: SectionType; label: string; help: string }[] = [
  { key: "parties", label: "From / to details", help: "Your company and the client, side by side" },
  { key: "text", label: "Text block", help: "Any heading and text; supports fill-in fields and simple formatting" },
  { key: "lineItems", label: "Line items table", help: "Items, quantities, prices, discounts and VAT" },
  { key: "totals", label: "Totals", help: "Subtotal, discount, VAT and total" },
  { key: "payment", label: "Payment details", help: "M-Pesa and bank details from the template" },
  { key: "terms", label: "Terms & conditions", help: "Numbered clauses" },
  { key: "signatures", label: "Signatures", help: "Signature lines for each party" },
  { key: "divider", label: "Divider", help: "A horizontal line" },
];

export interface Section {
  id: string;
  type: SectionType;
  title: string;
  body: string; // Markdown with {{fields}}; for "terms" one clause per paragraph
  visible: boolean;
  signatories?: { label: string }[];
}

export interface DocTemplateConfig {
  title: string; // printed heading, e.g. "QUOTATION"
  branding: {
    accent: string;
    accent2: string;
    showLogo: boolean;
    logoText: string;
    headerStyle: "split" | "stacked" | "band";
    font: "sans" | "serif";
    blendLine: boolean;
    paper: "A4" | "Letter";
  };
  company: { name: string; tagline: string; address: string; email: string; phone: string; website: string; taxPin: string; registrationNo: string };
  numbering: { prefix: string; pad: number; includeYear: boolean };
  money: { currency: string; vatEnabled: boolean; vatRate: number; pricesIncludeVat: boolean };
  payment: { mpesaPaybill: string; mpesaAccount: string; mpesaTill: string; bankName: string; bankAccountName: string; bankAccountNumber: string; bankBranch: string; swift: string; instructions: string };
  labels: { from: string; to: string; number: string; date: string; secondaryDate: string };
  validityDays: number;
  sections: Section[];
  footer: string;
}

export interface DocLine {
  description: string;
  details: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  vat: boolean;
}

export interface DocClient {
  name: string;
  organisation: string;
  email: string;
  phone: string;
  address: string;
  taxPin: string;
}

export interface DocData {
  date: string; // YYYY-MM-DD
  secondaryDate: string; // valid until (quotation), end date (contract), unused (receipt)
  reference: string;
  lines: DocLine[];
  notes: string;
  startDate: string;
  termMonths: number;
  amountReceived: number;
  method: string;
  paymentRef: string;
  forInvoice: string;
  signatories: { label: string; name: string; title: string }[];
}

export interface DocTotals {
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
  received: number;
  balance: number;
}

export const emptyClient = (): DocClient => ({ name: "", organisation: "", email: "", phone: "", address: "", taxPin: "" });
export const emptyLine = (): DocLine => ({ description: "", details: "", qty: 1, unitPrice: 0, discountPct: 0, vat: true });
