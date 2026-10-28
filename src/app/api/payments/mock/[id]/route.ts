import { NextResponse } from "next/server";
import { internal } from "@/lib/db";
import { settlePayment } from "@/lib/payments";

/** Test-mode only: simulates the customer approving or declining an STK push for a booking. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcome = new URL(req.url).searchParams.get("outcome") === "fail" ? "fail" : "success";
  const pay = await internal(async (tx) => {
    const [p] = await tx<{ id: string; provider: string }[]>`select p.id, p.provider from bookings b join payments p on p.id = b.payment_id where b.id = ${id}`;
    return p;
  }).catch(() => null);
  if (!pay || pay.provider !== "mock") return NextResponse.json({ error: "Not available" }, { status: 404 });
  await settlePayment(pay.id, { success: outcome === "success", receipt: outcome === "success" ? `TEST${Date.now().toString(36).toUpperCase()}` : undefined, detail: `Simulated ${outcome} (test mode)` });
  return NextResponse.json({ ok: true });
}
