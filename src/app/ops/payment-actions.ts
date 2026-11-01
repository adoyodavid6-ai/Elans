"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, requireSuper } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { INTERNAL_TENANT_ID } from "@/lib/db";
import { sign } from "@/lib/security";
import { registerC2bUrls, testMpesaConnection } from "@/lib/integrations/mpesa";
import { testPaystackConnection } from "@/lib/integrations/paystack";
import { refreshPayment } from "@/lib/payments";

const publicBase = () => (process.env.MPESA_CALLBACK_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Addresses to give Safaricom for paybill/till (C2B) confirmations. They carry a token only this server can create. */
export async function c2bUrls() {
  await requireSuper();
  const t = encodeURIComponent(sign("mpesa-c2b"));
  return { confirmation: `${publicBase()}/api/webhooks/mpesa/c2b/confirmation?t=${t}`, validation: `${publicBase()}/api/webhooks/mpesa/c2b/validation?t=${t}` };
}

export async function testProvider(provider: "mpesa" | "paystack") {
  const u = await requireSuper();
  const r = provider === "mpesa" ? await testMpesaConnection() : await testPaystackConnection();
  await asStaff(u, (tx) => audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: `payments.${provider}.tested`, meta: { ok: r.ok } }));
  await flash(r.message, r.ok ? "success" : "error");
  revalidatePath("/ops/payments");
}

export async function registerMpesaC2b() {
  const u = await requireSuper();
  const urls = await c2bUrls();
  const r = await registerC2bUrls(urls.confirmation, urls.validation);
  await asStaff(u, (tx) => audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "payments.mpesa.c2b_registered", meta: { ok: r.ok } }));
  await flash(r.ok ? `C2B URLs registered with Safaricom: ${r.message}` : `Not registered: ${r.message}`, r.ok ? "success" : "error");
  revalidatePath("/ops/payments");
}

export async function checkPayment(paymentId: string) {
  await requireStaff();
  const r = await refreshPayment(paymentId).catch((e) => ({ status: `error: ${(e as Error).message}` }));
  const status = "status" in r ? r.status : undefined;
  await flash(status === "pending" ? "Still waiting for the provider to confirm." : status ? `Payment is ${status}.` : "Checked.", status?.startsWith("error") ? "error" : "info");
  revalidatePath("/ops/payments");
}

/** Issues the receipt for a confirmed payment that has none yet (for example a paybill payment with no matching invoice). */
export async function issueReceipt(paymentId: string) {
  await requireSuper();
  const { autoReceipt } = await import("@/lib/receipts");
  const r = await autoReceipt(paymentId);
  await flash(r.status === "issued" ? `Receipt ${r.number} issued${r.emailedTo ? ` and emailed to ${r.emailedTo}` : " (no client email on file: send it from the document page)"}` : r.status === "exists" ? "A receipt already exists for this payment." : `No receipt issued: ${r.reason}`, r.status === "skipped" ? "error" : "success");
  revalidatePath("/ops/payments");
}
