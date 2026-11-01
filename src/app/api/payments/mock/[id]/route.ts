import { NextResponse } from "next/server";
import { internal } from "@/lib/db";
import { settlePayment } from "@/lib/payments";
import { mpesaMode } from "@/lib/integrations/mpesa";
import { rateLimit } from "@/lib/security";

/** Test-mode only: simulates the customer approving or declining an STK push for a booking. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Never available once real M-Pesa (sandbox or production) is configured.
  if (mpesaMode() !== "mock") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
  if (!rateLimit(`mockpay:${ip}`, 20, 10 * 60_000).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const outcome = new URL(req.url).searchParams.get("outcome") === "fail" ? "fail" : "success";
  const pay = await internal(async (tx) => {
    const [p] = await tx<{ id: string; provider: string }[]>`select p.id, p.provider from bookings b join payments p on p.id = b.payment_id where b.id = ${id}`;
    return p;
  }).catch(() => null);
  if (!pay || pay.provider !== "mock") return NextResponse.json({ error: "Not available" }, { status: 404 });
  await settlePayment(pay.id, { success: outcome === "success", receipt: outcome === "success" ? `TEST${Date.now().toString(36).toUpperCase()}` : undefined, detail: `Simulated ${outcome} (test mode)` });
  return NextResponse.json({ ok: true });
}
