import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/integrations/paystack";
import { settlePaystack } from "@/lib/payments";

/**
 * Paystack webhook. Requests must carry a valid HMAC-SHA512 signature of the raw body; the payment is then
 * re-verified with Paystack's API (amount and currency checked) before anything is marked paid.
 * Register this URL in the Paystack dashboard (Settings → API Keys & Webhooks).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"))) return NextResponse.json({ ok: false }, { status: 401 });
  let event: { event?: string; data?: { reference?: string } } = {};
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const ref = event.data?.reference ?? "";
  if (/^(charge\.success|charge\.failed)$/.test(event.event ?? "") && /^[0-9a-f-]{36}$/.test(ref)) {
    await settlePaystack(ref).catch((e) => console.error("[paystack webhook]", e));
  }
  return NextResponse.json({ ok: true });
}
