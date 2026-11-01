import { defaultData } from "./defaults";
import type { DocClient, DocData, DocKind, DocTemplateConfig } from "./types";

/** Illustrative client and lines used only in the template editor's preview. */
export function sampleFor(kind: DocKind, cfg: DocTemplateConfig): { client: DocClient; data: DocData } {
  const client: DocClient = { name: "Jane Wanjiru", organisation: "Sample Clinic Ltd (example)", email: "jane@example.com", phone: "0712 000 000", address: "Ngong Road, Nairobi", taxPin: "P000000000X" };
  const data = defaultData(kind, cfg);
  data.reference = kind === "receipt" ? "" : "Sample reference";
  if (kind === "receipt") {
    data.lines = [{ description: "Invoice ELN-2026-1001: Growth retainer, November", details: "", qty: 1, unitPrice: 60000, discountPct: 0, vat: false }];
    data.amountReceived = 60000;
    data.paymentRef = "TJK4X81QZP";
    data.forInvoice = "invoice ELN-2026-1001";
  } else {
    data.lines = [
      { description: "eTIMS Compliance & Reconciliation: setup", details: "Configuration, integration and supervised proving period", qty: 1, unitPrice: 120000, discountPct: 0, vat: true },
      { description: "Monthly run retainer", details: "Monitoring, support and monthly report", qty: 6, unitPrice: 20000, discountPct: 5, vat: true },
    ];
  }
  data.signatories = data.signatories.map((s, i) => ({ ...s, name: i === 0 ? client.name : "" }));
  return { client, data };
}
