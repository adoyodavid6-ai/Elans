import { describe, expect, it } from "vitest";
import { addMonths, amountInWords, computeTotals, fillFields, formatNumber, mergeFields } from "@/lib/documents/compute";
import { defaultData, defaultTemplate } from "@/lib/documents/defaults";
import { templateSchema } from "@/lib/documents/store";

describe("document maths", () => {
  it("adds VAT on exclusive prices and applies discounts first", () => {
    const cfg = defaultTemplate("quotation");
    const data = { ...defaultData("quotation", cfg), lines: [
      { description: "Setup", details: "", qty: 1, unitPrice: 100000, discountPct: 0, vat: true },
      { description: "Retainer", details: "", qty: 6, unitPrice: 20000, discountPct: 10, vat: true },
      { description: "Exempt item", details: "", qty: 1, unitPrice: 5000, discountPct: 0, vat: false },
    ] };
    const t = computeTotals("quotation", data, cfg);
    expect(t.subtotal).toBe(225000);
    expect(t.discount).toBe(12000);
    expect(t.net).toBe(213000);
    expect(t.vat).toBe(33280); // 16% of 208,000
    expect(t.total).toBe(246280);
  });
  it("extracts VAT from inclusive prices", () => {
    const cfg = defaultTemplate("quotation");
    cfg.money.pricesIncludeVat = true;
    const data = { ...defaultData("quotation", cfg), lines: [{ description: "Item", details: "", qty: 1, unitPrice: 11600, discountPct: 0, vat: true }] };
    const t = computeTotals("quotation", data, cfg);
    expect(t.net).toBe(10000);
    expect(t.vat).toBe(1600);
    expect(t.total).toBe(11600);
  });
  it("tracks amount received and balance on receipts", () => {
    const cfg = defaultTemplate("receipt");
    const data = { ...defaultData("receipt", cfg), amountReceived: 40000, lines: [{ description: "Invoice", details: "", qty: 1, unitPrice: 60000, discountPct: 0, vat: false }] };
    const t = computeTotals("receipt", data, cfg);
    expect(t.received).toBe(40000);
    expect(t.balance).toBe(20000);
  });
});

describe("document text", () => {
  it("writes amounts in words (UK English)", () => {
    expect(amountInWords(12500.5)).toBe("Twelve thousand five hundred shillings and fifty cents");
    expect(amountInWords(1)).toBe("One shilling");
    expect(amountInWords(2_000_105)).toBe("Two million one hundred and five shillings");
  });
  it("numbers documents from the template scheme", () => {
    const cfg = defaultTemplate("quotation");
    expect(formatNumber(cfg, 7, 2026)).toBe("QUO-2026-0007");
    cfg.numbering = { prefix: "INV/ELN", pad: 3, includeYear: false };
    expect(formatNumber(cfg, 42, 2026)).toBe("INV/ELN-042");
  });
  it("computes contract end dates", () => {
    expect(addMonths("2026-11-01", 6)).toBe("2027-04-30");
  });
  it("fills fields and leaves a blank for empty ones", () => {
    const cfg = defaultTemplate("quotation");
    const data = defaultData("quotation", cfg);
    const client = { name: "Jane", organisation: "Acme Ltd", email: "", phone: "", address: "", taxPin: "" };
    const fields = mergeFields({ kind: "quotation", number: "QUO-2026-0001", client, data, totals: computeTotals("quotation", data, cfg), cfg });
    expect(fillFields("Dear {{client.name}} of {{client.organisation}}, ref {{doc.number}}", fields)).toBe("Dear Jane of Acme Ltd, ref QUO-2026-0001");
    expect(fillFields("Email: {{client.email}}", fields)).toBe("Email: __________");
    expect(fillFields("{{client.email}}", fields, true)).toBe("⟨client.email⟩");
  });
  it("default templates pass validation", () => {
    for (const k of ["quotation", "contract", "receipt"] as const) expect(templateSchema.safeParse(defaultTemplate(k)).success, k).toBe(true);
  });
});
