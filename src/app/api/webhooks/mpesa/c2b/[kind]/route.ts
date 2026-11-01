import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { unsign } from "@/lib/security";
import { parseC2b } from "@/lib/integrations/mpesa";
import { autoReceipt } from "@/lib/receipts";

/**
 * M-Pesa C2B (customer paid the paybill or till from their phone). Daraja doesn't sign these requests, so the
 * registered URLs carry an HMAC token (`t`) that only this server can produce.
 *  - validation:   always accept (we don't reject payments)
 *  - confirmation: record once per M-Pesa transaction and match it to an open invoice by account number
 */
export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (unsign(new URL(req.url).searchParams.get("t") ?? "") !== "mpesa-c2b") return NextResponse.json({ ResultCode: "C2B00012", ResultDesc: "Rejected" }, { status: 403 });
  if (kind === "validation") return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
  if (kind !== "confirmation") return NextResponse.json({ ResultCode: "1", ResultDesc: "Unknown" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const c = parseC2b(body);
  if (!c) return NextResponse.json({ ResultCode: "1", ResultDesc: "Malformed" }, { status: 400 });
  const raw = { TransID: c.transId, TransAmount: c.amount, BillRefNumber: c.billRef, payer: c.payer, TransTime: (body as Record<string, unknown>)?.TransTime ?? null, TransactionType: (body as Record<string, unknown>)?.TransactionType ?? null };
  const outcome = await withDb({}, async (tx) => (await tx<{ r: string }[]>`select mpesa_c2b_confirm(${c.transId}, ${c.amount}, ${c.billRef}, ${c.payer}, ${tx.json(raw as never)}) as r`)[0]?.r ?? "").catch((e) => { console.error("[mpesa c2b]", e); return ""; });
  // Matched to an open invoice (account number and amount): issue the receipt and email the client now.
  // Unmatched payments are recorded for the team; there is no client email to send a receipt to.
  if (outcome.startsWith("matched:")) await autoReceipt(outcome.split(":")[2] ?? "");
  return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
}
