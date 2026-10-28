import "server-only";
import { generateInvoices, type RegistryRecord } from "./samples";

/**
 * MOCK eTIMS adaptor. Clearly labelled in every UI that uses it (DECISIONS D-020).
 * The registry is the synthetic dataset's "issued through eTIMS" records. A real adaptor
 * (accredited integrator or KRA-approved OSCU/VSCU route) implements the same interface.
 */
export interface EtimsCheck {
  status: "valid" | "not_found" | "mismatch";
  reason: string;
  reference: string;
}
export interface EtimsAdaptor {
  mode: "mock" | "live";
  check(q: { cuInvoiceNo: string; supplierPin: string | null; buyerPin: string | null; amountTotal: number | null }): Promise<EtimsCheck>;
}

let registry: Map<string, RegistryRecord> | null = null;
function reg() {
  if (!registry) registry = new Map(generateInvoices().registry.map((r) => [r.cuInvoiceNo.toUpperCase(), r]));
  return registry;
}

export const mockEtims: EtimsAdaptor = {
  mode: "mock",
  async check(q) {
    const rec = reg().get(q.cuInvoiceNo.toUpperCase());
    const ref = `MOCK-${Date.now().toString(36).toUpperCase()}`;
    if (!rec) return { status: "not_found", reason: "No eTIMS record found for this CU invoice number", reference: ref };
    if (q.supplierPin && rec.supplierPin !== q.supplierPin) return { status: "mismatch", reason: `Supplier PIN on the eTIMS record is ${rec.supplierPin}`, reference: ref };
    if (q.amountTotal !== null && Math.abs(rec.total - q.amountTotal) > 1) return { status: "mismatch", reason: `eTIMS total is KES ${rec.total.toLocaleString("en-GB")}, invoice shows KES ${q.amountTotal.toLocaleString("en-GB")}`, reference: ref };
    return { status: "valid", reason: "Matches the eTIMS record", reference: ref };
  },
};

export function etimsAdaptor(): EtimsAdaptor {
  // Only the mock exists until the integration route ({{ETIMS_ROUTE}}) is confirmed.
  return mockEtims;
}
