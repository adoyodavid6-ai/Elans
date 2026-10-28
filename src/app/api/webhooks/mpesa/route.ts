import { NextResponse } from "next/server";
import { unsign } from "@/lib/security";
import { parseStkCallback } from "@/lib/integrations/mpesa";
import { settleFromCallback } from "@/lib/payments";

/**
 * Daraja STK callback. Daraja does not sign callbacks, so the URL carries an HMAC-signed payment id
 * and the CheckoutRequestID must match the one we stored. Always 200 so Daraja does not retry forever.
 */
export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const paymentId = unsign(t);
  if (!paymentId) return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 403 });
  const cb = parseStkCallback(await req.json().catch(() => null));
  if (!cb) return NextResponse.json({ ResultCode: 1, ResultDesc: "Malformed" }, { status: 400 });
  await settleFromCallback(paymentId, cb);
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
