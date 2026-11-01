import "server-only";
import { withDb, type Tx } from "@/lib/db";

/**
 * Outbound messages are written to the outbox table first, inside the same transaction as the change that
 * caused them, then delivered by deliverOutbox() once that transaction has committed.
 *
 * Providers (environment variables; nothing is sent until they are set):
 *  - Email: EMAIL_PROVIDER=resend, RESEND_API_KEY, EMAIL_FROM ("Elans <hello@your-domain>", a domain verified in Resend)
 *  - SMS:   SMS_PROVIDER=africastalking, AT_USERNAME, AT_API_KEY, AT_SENDER_ID (optional)
 * Without a provider a message is stored as "logged" (visible in the console's Message log) and never sent.
 */
type Channel = "email" | "whatsapp" | "sms";

export function channelReady(channel: Channel): boolean {
  if (channel === "email") return process.env.EMAIL_PROVIDER === "resend" && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  if (channel === "sms") return process.env.SMS_PROVIDER === "africastalking" && Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY);
  return false; // WhatsApp sends go through the client runtime's WhatsApp adaptor, not the outbox
}

export async function queueMessage(tx: Tx, m: { channel: Channel; to: string; subject?: string; body: string; meta?: Record<string, unknown> }) {
  const status = channelReady(m.channel) && process.env.NODE_ENV !== "test" ? "queued" : "logged";
  await tx`insert into outbox (tenant_id, channel, to_addr, subject, body, status, meta)
    values (app_tenant(), ${m.channel}, ${m.to}, ${m.subject ?? null}, ${m.body}, ${status}, ${tx.json((m.meta ?? {}) as never)})`;
  if (status === "logged" && process.env.NODE_ENV !== "test") console.info(`[outbox:${m.channel}] → ${m.to}: ${m.subject ?? m.body.slice(0, 60)}`);
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, reply_to: process.env.EMAIL_REPLY_TO || undefined }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendSms(to: string, message: string): Promise<void> {
  const user = process.env.AT_USERNAME!;
  const host = user === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
  const form = new URLSearchParams({ username: user, to: to.startsWith("+") ? to : `+${to}`, message: message.slice(0, 459) });
  if (process.env.AT_SENDER_ID) form.set("from", process.env.AT_SENDER_ID);
  const res = await fetch(`${host}/version1/messaging`, { method: "POST", headers: { apiKey: process.env.AT_API_KEY!, accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { SMSMessageData?: { Recipients?: { status: string }[] } };
  if (!res.ok || body.SMSMessageData?.Recipients?.[0]?.status !== "Success") throw new Error(`Africa's Talking ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
}

/** Sends queued messages. Safe to run concurrently (rows are claimed with SKIP LOCKED); failures retry up to 5 times. */
export async function deliverOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  if (!channelReady("email") && !channelReady("sms")) return { sent: 0, failed: 0 };
  const rows = await withDb({ system: true }, (tx) => tx<{ id: string; channel: Channel; to_addr: string; subject: string | null; body: string }[]>`select * from outbox_claim(${limit})`);
  let sent = 0, failed = 0;
  for (const r of rows) {
    let error: string | null = null;
    try {
      if (r.channel === "email" && channelReady("email")) await sendEmail(r.to_addr, r.subject ?? "Message from Elans", r.body);
      else if (r.channel === "sms" && channelReady("sms")) await sendSms(r.to_addr, r.body);
      else error = `No provider configured for ${r.channel}`;
    } catch (e) {
      error = (e as Error).message;
    }
    await withDb({ system: true }, (tx) => tx`select outbox_mark(${r.id}, ${error === null}, ${error})`);
    if (error) failed++; else sent++;
  }
  return { sent, failed };
}

/** Best-effort delivery right after a commit (payments, bookings). Never throws. */
export async function deliverSoon() {
  try { await deliverOutbox(10); } catch (e) { console.error("[outbox] delivery failed", (e as Error).message); }
}
