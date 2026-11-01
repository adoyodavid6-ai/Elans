import "server-only";
import crypto from "node:crypto";

/**
 * Paystack adaptor (cards, and M-Pesa / bank transfer through Paystack in Kenya).
 * Uses the hosted checkout: we initialise a transaction, send the customer to Paystack, then confirm by
 * (a) the signed webhook and (b) verifying the transaction when the customer returns.
 *
 * Configuration: PAYSTACK_SECRET_KEY (sk_test_… or sk_live_…), PAYSTACK_CURRENCY (default KES),
 * PAYSTACK_CHANNELS (optional, e.g. "card,mobile_money,bank_transfer").
 */
export type PaystackMode = "off" | "test" | "live";
const API = "https://api.paystack.co";

export function paystackMode(): PaystackMode {
  const k = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (k.startsWith("sk_live_")) return "live";
  if (k.startsWith("sk_test_")) return "test";
  return "off";
}

export function paystackConfigStatus() {
  return {
    mode: paystackMode(),
    currency: process.env.PAYSTACK_CURRENCY || "KES",
    vars: [
      { key: "PAYSTACK_SECRET_KEY", set: Boolean(process.env.PAYSTACK_SECRET_KEY), optional: false },
      { key: "PAYSTACK_CURRENCY", set: Boolean(process.env.PAYSTACK_CURRENCY), optional: true },
      { key: "PAYSTACK_CHANNELS", set: Boolean(process.env.PAYSTACK_CHANNELS), optional: true },
    ],
  };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<{ status: boolean; message: string; data?: T }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "content-type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({ status: false, message: `Paystack returned ${res.status}` }))) as { status: boolean; message: string; data?: T };
  return body;
}

/** Amounts are sent in the currency's subunit (KES 1 = 100). */
export const toSubunit = (amount: number) => Math.round(amount * 100);

export async function initializeTransaction(p: { email: string; amount: number; currency: string; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; url?: string; message: string }> {
  if (paystackMode() === "off") return { ok: false, message: "Card payments are not set up yet." };
  const channels = (process.env.PAYSTACK_CHANNELS ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  try {
    const r = await call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({ email: p.email, amount: toSubunit(p.amount), currency: p.currency, reference: p.reference, callback_url: p.callbackUrl, metadata: p.metadata, ...(channels.length ? { channels } : {}) }),
    });
    return r.status && r.data ? { ok: true, url: r.data.authorization_url, message: "Redirecting to Paystack" } : { ok: false, message: r.message || "Paystack did not accept the request." };
  } catch (e) {
    return { ok: false, message: `Paystack is unavailable: ${(e as Error).message}` };
  }
}

export interface PaystackVerification {
  status: "success" | "failed" | "abandoned" | "pending" | "reversed" | string;
  amount: number; // subunit
  currency: string;
  channel: string;
  gatewayResponse: string;
  reference: string;
}

export async function verifyTransaction(reference: string): Promise<PaystackVerification | null> {
  if (paystackMode() === "off") return null;
  const r = await call<{ status: string; amount: number; currency: string; channel: string; gateway_response: string; reference: string }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (!r.status || !r.data) return null;
  return { status: r.data.status, amount: r.data.amount, currency: r.data.currency, channel: r.data.channel, gatewayResponse: r.data.gateway_response, reference: r.data.reference };
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key (x-paystack-signature). */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = process.env.PAYSTACK_SECRET_KEY ?? ""): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export async function testPaystackConnection(): Promise<{ ok: boolean; message: string }> {
  if (paystackMode() === "off") return { ok: false, message: "Paystack is not set up: add PAYSTACK_SECRET_KEY." };
  try {
    const r = await call<unknown[]>("/transaction?perPage=1");
    return r.status ? { ok: true, message: `Connected to Paystack (${paystackMode()} mode).` } : { ok: false, message: r.message };
  } catch (e) {
    return { ok: false, message: `Paystack is unavailable: ${(e as Error).message}` };
  }
}
