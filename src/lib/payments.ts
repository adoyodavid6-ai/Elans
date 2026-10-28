import "server-only";
import { internal, type Tx } from "@/lib/db";
import { sign } from "@/lib/security";
import { stkPush, mpesaMode, type StkCallback } from "@/lib/integrations/mpesa";
import { audit } from "@/lib/audit";
import { queueMessage } from "@/lib/outbox";

const siteUrl = () => process.env.MPESA_CALLBACK_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Creates a payment row (idempotent by key) and sends an STK push. */
export async function requestMpesaPayment(tx: Tx, p: { purpose: string; reference: string; amount: number; phone: string; idempotencyKey: string }) {
  const [existing] = await tx<{ id: string; status: string }[]>`select id, status from payments where idempotency_key = ${p.idempotencyKey}`;
  if (existing) return { paymentId: existing.id, message: "Payment already requested.", mode: mpesaMode() };
  const [pay] = await tx<{ id: string }[]>`insert into payments (tenant_id, provider, purpose, reference, amount, phone, idempotency_key)
    values (app_tenant(), ${mpesaMode() === "mock" ? "mock" : "mpesa"}, ${p.purpose}, ${p.reference}, ${p.amount}, ${p.phone}, ${p.idempotencyKey}) returning id`;
  const callbackUrl = `${siteUrl()}/api/webhooks/mpesa?t=${encodeURIComponent(sign(pay.id))}`;
  const r = await stkPush({ phone: p.phone, amount: p.amount, reference: p.reference, description: "Elans session", callbackUrl });
  await tx`update payments set provider_ref = ${r.checkoutRequestId ?? null}, status = ${r.ok ? "pending" : "failed"}, raw = ${tx.json({ request: { mode: r.mode, message: r.message } })}, updated_at = now() where id = ${pay.id}`;
  return { paymentId: pay.id, message: r.message, mode: r.mode, ok: r.ok };
}

/** Applies a payment outcome and confirms the linked booking. Safe to call more than once. */
export async function settlePayment(paymentId: string, outcome: { success: boolean; receipt?: string; detail: string; raw?: unknown }) {
  return internal(async (tx) => {
    const [p] = await tx<{ id: string; status: string; reference: string }[]>`select id, status, reference from payments where id = ${paymentId} for update`;
    if (!p || p.status !== "pending") return { changed: false };
    await tx`update payments set status = ${outcome.success ? "succeeded" : "failed"}, provider_ref = coalesce(${outcome.receipt ?? null}, provider_ref),
      raw = raw || ${tx.json({ callback: (outcome.raw ?? { detail: outcome.detail }) as never })}, updated_at = now() where id = ${paymentId}`;
    if (outcome.success) {
      const [b] = await tx<{ id: string; contact_id: string; starts_at: Date; type: string }[]>`update bookings set status = 'confirmed' where payment_id = ${paymentId} and status = 'pending_payment' returning id, contact_id, starts_at, type`;
      if (b) {
        const [c] = await tx<{ email: string; name: string }[]>`select email, name from contacts where id = ${b.contact_id}`;
        if (c) await queueMessage(tx, { channel: "email", to: c.email, subject: "Your Elans session is confirmed", body: `Hello ${c.name},\n\nYour ${b.type} session on ${b.starts_at.toUTCString()} is confirmed. Receipt: ${outcome.receipt ?? "n/a"}.\n\nThe Elans team` });
      }
    }
    await audit(tx, { tenantId: (await tx`select app_tenant() as t`)[0].t, actorLabel: "payment-provider", action: outcome.success ? "payment.succeeded" : "payment.failed", entity: "payment", entityId: paymentId, meta: { detail: outcome.detail } });
    return { changed: true };
  });
}

export async function settleFromCallback(paymentId: string, cb: StkCallback) {
  // Bind the callback to the payment we created: the CheckoutRequestID must match.
  const ok = await internal(async (tx) => {
    const [p] = await tx<{ provider_ref: string | null }[]>`select provider_ref from payments where id = ${paymentId}`;
    return p && p.provider_ref === cb.checkoutRequestId;
  });
  if (!ok) return { changed: false, reason: "mismatch" };
  return settlePayment(paymentId, { success: cb.resultCode === 0, receipt: cb.receipt, detail: cb.resultDesc, raw: cb });
}
