/**
 * Deterministic synthetic invoices for the eTIMS demo tenant and evaluation set.
 * They are rendered as text in the style of Kenyan supplier invoices (including messy variants).
 * Synthetic data is labelled as such everywhere it appears; a real eval set needs consented client invoices.
 */

export interface SyntheticInvoice {
  id: string;
  text: string;
  expected: {
    supplierPin: string | null;
    supplierName: string;
    buyerPin: string | null;
    invoiceNo: string | null;
    cuInvoiceNo: string | null;
    invoiceDate: string | null; // YYYY-MM-DD
    amountTotal: number | null;
    vatAmount: number | null;
  };
  expectedStatus: "valid" | "not_found" | "mismatch" | "needs_review" | "duplicate" | "invalid";
  scenario: string;
}

export interface RegistryRecord {
  cuInvoiceNo: string;
  supplierPin: string;
  buyerPin: string;
  total: number;
  date: string;
}

export const DEMO_BUYER_PIN = "P051234567Z";

const SUPPLIERS = [
  ["Mwangaza Cement Distributors", "P051111111A"],
  ["Kiboko Steel & Wire Ltd", "P052222222B"],
  ["Pwani Timber Merchants", "A003333333C"],
  ["Rift Valley Paints Co", "P054444444D"],
  ["Nyota Electricals", "P055555555E"],
  ["Lake Basin Plumbing Supplies", "A006666666F"],
  ["Savannah Transporters", "P057777777G"],
  ["Mlima Hardware Wholesalers", "P058888888H"],
];

// Small deterministic PRNG so samples are identical on every run.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const fmt = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateInvoices(count = 60, period = "2026-10", seed = 2026): { invoices: SyntheticInvoice[]; registry: RegistryRecord[] } {
  const r = rng(seed);
  const invoices: SyntheticInvoice[] = [];
  const registry: RegistryRecord[] = [];
  const [y, m] = period.split("-").map(Number);
  for (let i = 0; i < count; i++) {
    const [name, pin] = SUPPLIERS[Math.floor(r() * SUPPLIERS.length)];
    const day = 1 + Math.floor(r() * 27);
    const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const net = Math.round((5000 + r() * 245000) / 10) * 10;
    const vat = Math.round(net * 0.16 * 100) / 100;
    const total = Math.round((net + vat) * 100) / 100;
    const invoiceNo = `INV-${String(1000 + i * 7).padStart(5, "0")}`;
    const cu = `KRAMW${String(Math.floor(r() * 9e9) + 1e9)}${String(i).padStart(4, "0")}`;
    const roll = r();
    let scenario = "clean";
    let expectedStatus: SyntheticInvoice["expectedStatus"] = "valid";
    let regTotal = total;
    let printedCu: string | null = cu;
    let buyer: string | null = DEMO_BUYER_PIN;
    let style = Math.floor(r() * 3);
    if (roll < 0.14) {
      scenario = "not issued through eTIMS";
      expectedStatus = "not_found";
    } else if (roll < 0.24) {
      scenario = "amount differs from eTIMS record";
      expectedStatus = "mismatch";
      regTotal = Math.round((total - 1000 - r() * 4000) * 100) / 100;
    } else if (roll < 0.32) {
      scenario = "missing CU invoice number";
      expectedStatus = "needs_review";
      printedCu = null;
    } else if (roll < 0.38) {
      scenario = "issued to wrong buyer PIN";
      expectedStatus = "invalid";
      buyer = "P059999999K";
    } else if (roll < 0.46) {
      scenario = "messy layout";
      style = 3;
    }
    if (expectedStatus !== "not_found" && printedCu) registry.push({ cuInvoiceNo: cu, supplierPin: pin, buyerPin: buyer ?? DEMO_BUYER_PIN, total: regTotal, date });
    const lines = [
      ["Cement 50kg bags", "Steel bars Y12", "Roofing sheets 30g", "Gloss paint 4L", "PVC pipes 4in", "Delivery charges", "Timber 2x4", "Cable 2.5mm"][Math.floor(r() * 8)],
      ["Nails 3in (kg)", "Binding wire", "Wall putty", "Tiles 40x40", "Door hinges"][Math.floor(r() * 5)],
    ];
    const text =
      style === 0
        ? `${name.toUpperCase()}\nPIN: ${pin}\nTAX INVOICE\nInvoice No: ${invoiceNo}\nDate: ${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}\nBill to: Demo Hardware & Supplies Ltd  PIN ${buyer ?? ""}\n${lines[0]} ........ ${fmt(net * 0.7)}\n${lines[1]} ........ ${fmt(net * 0.3)}\nSubtotal: ${fmt(net)}\nVAT 16%: ${fmt(vat)}\nTOTAL KES: ${fmt(total)}\n${printedCu ? `CU Invoice No: ${printedCu}` : "Thank you for your business"}\n`
        : style === 1
          ? `Tax Invoice | ${name}\nSupplier KRA PIN ${pin}\nInv # ${invoiceNo}   Dated ${date}\nCustomer: DEMO HARDWARE & SUPPLIES LTD (PIN: ${buyer ?? "n/a"})\nAmount excl. VAT  ${fmt(net)}\nVAT               ${fmt(vat)}\nAmount incl. VAT  ${fmt(total)}\n${printedCu ? `Control Unit Invoice Number ${printedCu}` : ""}\n`
          : style === 2
            ? `${name}\nInvoice: ${invoiceNo}\nDate: ${day} ${["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m]} ${y}\nPIN No. ${pin}\nBuyer PIN: ${buyer ?? "-"}\nGoods: ${lines[0]}, ${lines[1]}\nNet ${fmt(net)} | VAT ${fmt(vat)} | Gross ${fmt(total)}\n${printedCu ? `CUIN: ${printedCu}` : ""}\n`
            : `${name.toLowerCase()} ... invoice ${invoiceNo.toLowerCase()} ... pin ${pin.toLowerCase()}\ndate ${String(day).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y} customer pin ${buyer?.toLowerCase() ?? ""}\ntotal kes ${total.toFixed(2)} (vat ${vat.toFixed(2)} incl)\n${printedCu ? `cu no ${printedCu.toLowerCase()}` : ""}\n`;
    invoices.push({
      id: `syn-${String(i + 1).padStart(3, "0")}`,
      text,
      scenario,
      expectedStatus,
      expected: { supplierPin: pin, supplierName: name, buyerPin: buyer, invoiceNo, cuInvoiceNo: printedCu, invoiceDate: date, amountTotal: total, vatAmount: vat },
    });
  }
  // Two exact duplicates (same supplier + invoice number) to exercise duplicate detection.
  for (const src of [invoices[3], invoices[11]]) {
    invoices.push({ ...src, id: `${src.id}-dup`, scenario: "duplicate submission", expectedStatus: "duplicate" });
  }
  return { invoices, registry };
}
