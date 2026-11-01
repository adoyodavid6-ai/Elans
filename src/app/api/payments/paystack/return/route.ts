import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { settlePaystack } from "@/lib/payments";

/** Where Paystack sends the customer after checkout: verify the payment, then return them to where they started. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref") ?? url.searchParams.get("reference") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(ref)) return NextResponse.redirect(new URL("/", url));
  await settlePaystack(ref).catch(() => null);
  const [p] = await withDb({}, (tx) => tx<{ status: string; return_path: string | null }[]>`select status, return_path from payment_locate(${ref})`).catch(() => []);
  const back = p?.return_path?.startsWith("/") ? p.return_path : "/";
  const dest = new URL(back, url);
  dest.searchParams.set("payment", p?.status === "succeeded" ? "success" : p?.status === "failed" ? "failed" : "pending");
  return NextResponse.redirect(dest);
}
