import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sendDueReminders } from "@/lib/reminders";
import { deliverOutbox } from "@/lib/outbox";

export const dynamic = "force-dynamic";

/**
 * Scheduled job: sends session reminders that are due and delivers queued messages.
 * Call every 5 minutes with "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends this header automatically;
 * the GitHub Actions workflow in .github/workflows/reminders.yml does the same).
 */
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const r = await sendDueReminders();
  const d = await deliverOutbox(50);
  return NextResponse.json({ ok: true, ...r, ...d });
}
export const POST = GET;
