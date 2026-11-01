import type { DocData, DocKind, DocTemplateConfig, Section } from "./types";
import { emptyClient } from "./types";

let n = 0;
const sec = (type: Section["type"], title: string, body = "", extra: Partial<Section> = {}): Section => ({ id: `s${++n}-${type}`, type, title, body, visible: true, ...extra });

const base = (title: string, prefix: string): Omit<DocTemplateConfig, "sections" | "footer"> => ({
  title,
  branding: { accent: "#6A012A", accent2: "#007D7D", showLogo: true, logoText: "E", headerStyle: "split", font: "sans", blendLine: true, paper: "A4" },
  company: { name: "Elans", tagline: "Intelligent Systems. Measurable Results.", address: "Nairobi, Kenya", email: "", phone: "", website: "", taxPin: "", registrationNo: "" },
  numbering: { prefix, pad: 4, includeYear: true },
  money: { currency: "KES", vatEnabled: true, vatRate: 16, pricesIncludeVat: false },
  payment: { mpesaPaybill: "", mpesaAccount: "", mpesaTill: "", bankName: "", bankAccountName: "", bankAccountNumber: "", bankBranch: "", swift: "", instructions: "Please quote the document number as your payment reference." },
  labels: { from: "From", to: "Prepared for", number: "Number", date: "Date", secondaryDate: "" },
  validityDays: 30,
});

export function defaultTemplate(kind: DocKind): DocTemplateConfig {
  if (kind === "quotation") {
    return {
      ...base("QUOTATION", "QUO"),
      labels: { from: "From", to: "Prepared for", number: "Quotation no.", date: "Date", secondaryDate: "Valid until" },
      sections: [
        sec("parties", ""),
        sec("text", "Introduction", "Dear {{client.name}},\n\nThank you for the opportunity to support {{client.organisation}}. This quotation sets out the scope and price of the work we discussed."),
        sec("lineItems", "Scope and pricing"),
        sec("totals", ""),
        sec("terms", "Terms", "This quotation is valid until {{quote.validUntil}}.\n\nPrices are in the currency shown, and VAT at {{vat.rate}} is shown separately where it applies.\n\nWork starts on written acceptance and payment of any deposit stated above.\n\nChanges to scope are quoted separately before work begins."),
        sec("payment", "How to pay"),
        sec("signatures", "Acceptance", "", { signatories: [{ label: "For the client" }, { label: "For {{company.name}}" }] }),
      ],
      footer: "{{company.name}} · {{company.address}} · {{company.email}} · KRA PIN {{company.taxPin}}",
    };
  }
  if (kind === "contract") {
    return {
      ...base("SERVICES AGREEMENT", "CON"),
      labels: { from: "Service provider", to: "Client", number: "Agreement no.", date: "Date", secondaryDate: "End date" },
      money: { currency: "KES", vatEnabled: true, vatRate: 16, pricesIncludeVat: false },
      sections: [
        sec("parties", ""),
        sec("text", "1. Parties and purpose", "This agreement is made on {{doc.date}} between **{{company.name}}** (\"the Provider\") and **{{client.organisation}}** (\"the Client\"). The Provider will deliver the services described below on the terms of this agreement."),
        sec("lineItems", "2. Services and fees"),
        sec("totals", ""),
        sec("text", "3. Term", "This agreement starts on {{contract.startDate}} and runs for a minimum term of {{contract.termMonths}} months, ending on {{contract.endDate}} unless renewed or ended under clause 8."),
        sec("terms", "4. Terms", "**Payment.** Invoices are payable within 14 days of issue. Monthly fees are invoiced in advance.\n\n**Scope changes.** Work outside the services above is agreed in writing as a change order before it starts.\n\n**Client responsibilities.** The Client provides timely access to people, data and systems reasonably needed, and names an approver for each automated action that requires approval.\n\n**Data protection.** Each party complies with the Kenya Data Protection Act 2019. Where the Provider processes personal data for the Client, it does so as a data processor under the data processing terms, only on the Client's instructions, and does not use Client data to train AI models.\n\n**Confidentiality.** Each party keeps the other's confidential information confidential and uses it only for this agreement.\n\n**Intellectual property.** The Client owns its data and outputs created specifically for it. The Provider keeps ownership of its pre-existing tools, templates and know-how, and grants the Client a licence to use them for the services.\n\n**Liability.** Neither party is liable for indirect or consequential loss. Each party's total liability is limited to the fees paid in the 12 months before the claim, except where the law does not allow such a limit.\n\n**Termination.** Either party may end this agreement with 30 days' written notice after the minimum term, or immediately if the other materially breaches it and does not fix the breach within 14 days of notice.\n\n**Governing law.** This agreement is governed by the laws of Kenya."),
        sec("payment", "Payment details"),
        sec("signatures", "Signed", "", { signatories: [{ label: "For the Client" }, { label: "For {{company.name}}" }] }),
      ],
      footer: "{{company.name}} · Agreement {{doc.number}} · {{company.email}}",
    };
  }
  return {
    ...base("RECEIPT", "RCT"),
    labels: { from: "Received by", to: "Received from", number: "Receipt no.", date: "Date", secondaryDate: "" },
    money: { currency: "KES", vatEnabled: false, vatRate: 16, pricesIncludeVat: true },
    sections: [
      sec("parties", ""),
      sec("text", "", "Received with thanks from **{{client.organisation}}** the sum of **{{receipt.amount}}** ({{receipt.amountInWords}}) by {{receipt.method}}, reference **{{receipt.reference}}**, in payment of {{receipt.forInvoice}}."),
      sec("lineItems", "Payment for"),
      sec("totals", ""),
      sec("signatures", "", "", { signatories: [{ label: "Received by" }] }),
    ],
    footer: "{{company.name}} · {{company.address}} · This receipt was generated electronically.",
  };
}

export function defaultData(kind: DocKind, cfg: DocTemplateConfig): DocData {
  const today = new Date().toISOString().slice(0, 10);
  const plus = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
  const sigs = (cfg.sections.find((s) => s.type === "signatures")?.signatories ?? []).map((s) => ({ label: s.label, name: "", title: "" }));
  return {
    date: today,
    secondaryDate: kind === "quotation" ? plus(cfg.validityDays || 30) : "",
    reference: "",
    lines: [{ description: "", details: "", qty: 1, unitPrice: 0, discountPct: 0, vat: cfg.money.vatEnabled }],
    notes: "",
    startDate: kind === "contract" ? today : "",
    termMonths: kind === "contract" ? 6 : 0,
    amountReceived: 0,
    method: kind === "receipt" ? "M-Pesa" : "",
    paymentRef: "",
    forInvoice: "",
    signatories: sigs,
  };
}

export const blankClient = emptyClient;
