import { describe, expect, it } from "vitest";
import { matchCandidates } from "@/lib/solutions/recon/workflow";
import { extractFromText, validate } from "@/lib/solutions/etims/extract";
import { DEMO_BUYER_PIN, generateInvoices } from "@/lib/solutions/etims/samples";
import { mockEtims } from "@/lib/solutions/etims/etims-mock";

const open = [
  { id: "r1", number: "INV-1", customer_name: "Jane Wanjiru", customer_phone: "254712000111", account_ref: "ACC-1", balance: 12500 },
  { id: "r2", number: "INV-2", customer_name: "Peter Otieno", customer_phone: "254722000222", account_ref: "ACC-2", balance: 8000 },
];

describe("reconciliation matching", () => {
  it("matches an exact account reference with full confidence", () => {
    const [best] = matchCandidates({ txnRef: "X1", txnAt: "", amount: 12500, reference: "ACC-1" }, open);
    expect(best.receivableId).toBe("r1");
    expect(best.confidence).toBe(1);
  });
  it("uses phone plus exact amount when the reference is missing", () => {
    const [best] = matchCandidates({ txnRef: "X2", txnAt: "", amount: 8000, payerPhone: "0722000222" }, open);
    expect(best.receivableId).toBe("r2");
    expect(best.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it("only suggests (below auto threshold) on a name-only match", () => {
    const [best] = matchCandidates({ txnRef: "X3", txnAt: "", amount: 5000, payerName: "PETER OTIENO", reference: "shop" }, open);
    expect(best.receivableId).toBe("r2");
    expect(best.confidence).toBeLessThan(0.9);
  });
  it("returns nothing when there is no evidence", () => {
    expect(matchCandidates({ txnRef: "X4", txnAt: "", amount: 777, payerName: "ALI OMAR" }, open)).toEqual([]);
  });
});

describe("eTIMS extraction and checks", () => {
  const { invoices } = generateInvoices();
  it("extracts the fields of a clean synthetic invoice", () => {
    const inv = invoices.find((i) => i.scenario === "clean")!;
    const { fields } = extractFromText(inv.text);
    expect(fields.supplierPin).toBe(inv.expected.supplierPin);
    expect(fields.amountTotal).toBeCloseTo(inv.expected.amountTotal!, 2);
  });
  it("flags an invoice issued to another buyer PIN", () => {
    const flags = validate({ supplierName: "X", supplierPin: "P051111111A", buyerPin: "P059999999K", invoiceNo: "1", cuInvoiceNo: "KRA1", invoiceDate: "2026-10-01", amountTotal: 100, vatAmount: 16 }, { buyerPin: DEMO_BUYER_PIN, period: "2026-10" });
    expect(flags.some((f) => f.startsWith("Issued to buyer PIN"))).toBe(true);
  });
  it("mock eTIMS reports unknown CU numbers as not found", async () => {
    const r = await mockEtims.check({ cuInvoiceNo: "KRAMW000000000000000", supplierPin: null, buyerPin: null, amountTotal: null });
    expect(r.status).toBe("not_found");
  });
});
