import "server-only";
import { withDb, type Tx } from "@/lib/db";
import { sign } from "@/lib/security";
import { stkPush, stkQuery, mpesaMode, type StkCallback } from "@/lib/integrations/mpesa";
import { initializeTransaction, paystackMode, verifyTransaction, toSubunit } from "@/lib/integrations/paystack";
import { audit } from "@/lib/audit";
import { deliverSoon, queueMessage } from "@/lib/outbox";
import { autoReceipt } from "@/lib/receipts";

/**
 * Payments across providers: M-Pesa STK push, Paystack hosted checkout, and the test-mode simulator.
 * A payment row lives in the tenant that is being paid for (Elans internal for sessions; a client tenant
 * for portal invoices). Webhooks locate it with the definer function payment_locate().
 */
const publicBase = () => (process.env.MPESA_CALLBACK_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const siteBase = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export function paymentOptions() {
  return { mpesa: mpesaMode(), paystack: paystackMode() };
}

/** Creates a payment row (idempotent by key) and sends an M-Pesa STK push. */
export async function requestMpesaPayment(tx: Tx, p: { purpose: string; reference: string; amount: number; phone: string; idempotencyKey: string; description?: string }) {
  const [existing] = await tx<{ id: string; status: string }[]>`select id, status from payments where idempotency_key = ${p.idempotencyKey}`;
  if (existing) return { paymentId: existing.id, message: "Payment already requested.", mode: mpesaMode(), ok: existing.status !== "failed" };
  const [pay] = await tx<{ id: string }[]>`insert into payments (tenant_id, provider, purpose, reference, amount, phone, idempotency_key)
    values (app_tenant(), ${mpesaMode() === "mock" ? "mock" : "mpesa"}, ${p.purpose}, ${p.reference}, ${p.amount}, ${p.phone}, ${p.idempotencyKey}) returning id`;
  const callbackUrl = `${publicBase()}/api/webhooks/mpesa?t=${encodeURIComponent(sign(pay.id))}`;
  const r = await stkPush({ phone: p.phone, amount: p.amount, reference: p.reference, description: p.description ?? "Elans", callbackUrl });
  await tx`update payments set provider_ref = ${r.checkoutRequestId ?? null}, status = ${r.ok ? "pending" : "failed"}, channel = 'mpesa', raw = ${tx.json({ request: { mode: r.mode, message: r.message } })}, updated_at = now() where id = ${pay.id}`;
  return { paymentId: pay.id, message: r.message, mode: r.mode, ok: r.ok };
}

/**
 * Creates a payment row and a Paystack checkout. The Paystack reference is our payment id, so the webhook
 * and the return page can find the payment without trusting anything else in the request.
 */
export async function requestPaystackPayment(tx: Tx, p: { purpose: string; reference: string; amount: number; email: string; idempotencyKey: string; returnPath: string; description?: string }) {
  const currency = (process.env.PAYSTACK_CURRENCY || "KES").toUpperCase();
  const [pay] = await tx<{ id: string }[]>`insert into payments (tenant_id, provider, purpose, reference, amount, currency, email, idempotency_key, return_path)
    values (app_tenant(), 'paystack', ${p.purpose}, ${p.reference}, ${p.amount}, ${currency}, ${p.email}, ${`${p.idempotencyKey}:${Date.now()}`}, ${p.returnPath}) returning id`;
  const r = await initializeTransaction({ email: p.email, amount: p.amount, currency, reference: pay.id, callbackUrl: `${siteBase()}/api/payments/paystack/return?ref=${pay.id}`, metadata: { purpose: p.purpose, reference: p.reference, description: p.description } });
  await tx`update payments set provider_ref = ${pay.id}, status = ${r.ok ? "pending" : "failed"}, raw = ${tx.json({ request: { mode: paystackMode(), message: r.message } })}, updated_at = now() where id = ${pay.id}`;
  return { paymentId: pay.id, ok: r.ok, url: r.url, message: r.message };
}

async function locate(paymentId: string) {
  if (!/^[0-9a-f-]{36}$/.test(paymentId)) return null;
  const [p] = await withDb({}, (tx) => tx<{ tenant_id: string; provider: string; provider_ref: string | null; status: string; amount: number; currency: string; purpose: string; return_path: string | null }[]>`select * from payment_locate(${paymentId})`);
  return p ?? null;
}

/** Applies a payment outcome: confirms a booking or marks a client invoice paid. Safe to call more than once. */
export async function settlePayment(paymentId: string, outcome: { success: boolean; receipt?: string; detail: string; channel?: string; raw?: unknown }) {
  const loc = await locate(paymentId);
  if (!loc) return { changed: false };
  const result = await withDb({ tenantId: loc.tenant_id }, async (tx) => {
    const [p] = await tx<{ id: string; status: string; reference: string; purpose: string; amount: number }[]>`select id, status, reference, purpose, amount from payments where id = ${paymentId} for update`;
    if (!p || p.status !== "pending") return { changed: false };
    await tx`update payments set status = ${outcome.success ? "succeeded" : "failed"}, provider_ref = coalesce(${outcome.receipt ?? null}, provider_ref), channel = coalesce(${outcome.channel ?? null}, channel),
      raw = raw || ${tx.json({ callback: (outcome.raw ?? { detail: outcome.detail }) as never })}, updated_at = now() where id = ${paymentId}`;
    if (outcome.success) {
      const [b] = await tx<{ id: string; contact_id: string; starts_at: Date; type: string }[]>`update bookings set status = 'confirmed' where payment_id = ${paymentId} and status = 'pending_payment' returning id, contact_id, starts_at, type`;
      if (b) {
        const [c] = await tx<{ email: string; name: string }[]>`select email, name from contacts where id = ${b.contact_id}`;
        const when = b.starts_at.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
        if (c) await queueMessage(tx, { channel: "email", to: c.email, subject: "Your Elans session is confirmed", body: `Hello ${c.name},\n\nYour payment is confirmed and your session on ${when} (EAT) is booked. Your receipt follows in a separate email.\n\nWe'll remind you 45 minutes before it starts.\n\nThe Elans team` });
      }
      if (p.purpose.startsWith("invoice:")) {
        await tx`update invoices set status = 'paid', paid_at = now() where number = ${p.purpose.slice(8)} and status in ('issued','overdue')`;
      }
    }
    await audit(tx, { tenantId: loc.tenant_id, actorLabel: "payment-provider", action: outcome.success ? "payment.succeeded" : "payment.failed", entity: "payment", entityId: paymentId, meta: { detail: outcome.detail, receipt: outcome.receipt } });
    return { changed: true };
  });
  if (result.changed) {
    // Receipt straight after a confirmed payment, then deliver the queued emails.
    if (outcome.success) await autoReceipt(paymentId);
    await deliverSoon();
  }
  return result;
}

export async function settleFromCallback(paymentId: string, cb: StkCallback) {
  // Bind the callback to the payment we created: the CheckoutRequestID must match.
  const loc = await locate(paymentId);
  if (!loc || loc.provider_ref !== cb.checkoutRequestId) return { changed: false, reason: "mismatch" };
  // Genuine payments only: the amount M-Pesa reports must be the amount we asked for.
  if (cb.resultCode === 0 && cb.amount !== undefined && Math.abs(cb.amount - Number(loc.amount)) >= 1) {
    return settlePayment(paymentId, { success: false, detail: `Amount mismatch: M-Pesa reported ${cb.amount}, expected ${loc.amount}. Check before confirming by hand.`, channel: "mpesa", raw: cb });
  }
  return settlePayment(paymentId, { success: cb.resultCode === 0, receipt: cb.receipt, detail: cb.resultDesc, channel: "mpesa", raw: cb });
}

/** Settles a Paystack payment only after confirming it with Paystack (amount and currency must match). */
export async function settlePaystack(paymentId: string) {
  const loc = await locate(paymentId);
  if (!loc || loc.provider !== "paystack" || loc.status !== "pending") return { changed: false, status: loc?.status };
  const v = await verifyTransaction(paymentId);
  if (!v || v.status === "pending" || v.status === "ongoing") return { changed: false, status: "pending" };
  const amountOk = v.amount === toSubunit(Number(loc.amount)) && v.currency.toUpperCase() === loc.currency.toUpperCase();
  if (v.status === "success" && !amountOk) return settlePayment(paymentId, { success: false, detail: `Amount or currency mismatch (${v.amount} ${v.currency})`, raw: v });
  return settlePayment(paymentId, { success: v.status === "success", receipt: v.reference, detail: v.gatewayResponse || v.status, channel: v.channel, raw: v });
}

/**
 * Re-checks a pending payment with its provider. Used when a confirmation may have been lost: the
 * booking confirmation page, the client's billing page and the console's Payments page call it.
 */
export async function refreshPayment(paymentId: string) {
  const loc = await locate(paymentId);
  if (!loc || loc.status !== "pending") return { status: loc?.status ?? "unknown" };
  if (loc.provider === "paystack") return settlePaystack(paymentId);
  if (loc.provider === "mpesa" && loc.provider_ref) {
    const q = await stkQuery(loc.provider_ref).catch(() => null);
    if (!q) return { status: "pending" };
    await settlePayment(paymentId, { success: q.resultCode === 0, detail: q.resultDesc, channel: "mpesa", raw: { query: q } });
    return { status: q.resultCode === 0 ? "succeeded" : "failed" };
  }
  return { status: "pending" };
}
