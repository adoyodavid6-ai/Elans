"use server";

import { z } from "zod";
import { internal } from "@/lib/db";
import { captureLead } from "@/lib/leads";
import { SESSION_TYPES, availableSlots, type SessionType } from "@/lib/booking";
import { getCatalogue } from "@/lib/content";
import { normaliseMsisdn } from "@/lib/integrations/mpesa";
import { requestMpesaPayment } from "@/lib/payments";
import { clientIp } from "@/lib/request";
import { rateLimit, verifyTurnstile } from "@/lib/security";
import { queueMessage } from "@/lib/outbox";

const schema = z.object({
  type: z.enum(["discovery", "strategy", "support"]),
  slot: z.iso.datetime(),
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  phone: z.string().trim().max(30).optional().default(""),
  organisation: z.string().trim().min(1).max(160),
  topic: z.string().trim().max(1000).optional().default(""),
  payWith: z.enum(["mpesa", "invoice"]).optional().default("mpesa"),
  consentContact: z.literal(true),
  consentMarketing: z.boolean().default(false),
  turnstile: z.string().optional(),
  honeypot: z.string().optional(),
});

export type BookingResult = { ok: true; bookingId: string } | { ok: false; message: string; field?: string };

export async function createBooking(input: unknown): Promise<BookingResult> {
  const p = schema.safeParse(input);
  if (!p.success) {
    const i = p.error.issues[0];
    return { ok: false, message: i.path[0] === "consentContact" ? "Please agree to the privacy notice." : "Please check your details.", field: String(i.path[0]) };
  }
  const d = p.data;
  if (d.honeypot) return { ok: false, message: "Rejected." };
  const ip = await clientIp();
  if (!rateLimit(`booking:${ip}`, 5, 30 * 60_000).ok) return { ok: false, message: "Too many booking attempts; please try again later." };
  if (!(await verifyTurnstile(d.turnstile, ip))) return { ok: false, message: "We could not verify that you are human." };

  const slots = await availableSlots(d.type as SessionType, 21);
  if (!slots.includes(new Date(d.slot).toISOString())) return { ok: false, message: "That time is no longer available. Please pick another.", field: "slot" };

  const cat = await getCatalogue();
  const meta = SESSION_TYPES[d.type as SessionType];
  const price = cat.pricePoints.find((x) => x.key === meta.priceKey);
  const amount = d.type === "discovery" && cat.settings.discoveryCallFree ? 0 : (price?.amount ?? 0);
  let msisdn: string | null = null;
  if (amount > 0 && d.payWith === "mpesa") {
    msisdn = normaliseMsisdn(d.phone);
    if (!msisdn) return { ok: false, message: "Enter the M-Pesa number to charge, e.g. 0712 345 678.", field: "phone" };
  }

  try {
    const bookingId = await internal(async (tx) => {
      const { leadId, contactId } = await captureLead({ name: d.name, email: d.email, phone: d.phone, organisation: d.organisation, source: "booking", sourceDetail: meta.name, message: d.topic, consentContact: true, consentMarketing: d.consentMarketing, consentPurpose: "booking" }, tx);
      const start = new Date(d.slot);
      const end = new Date(start.getTime() + meta.minutes * 60_000);
      const status = amount > 0 ? "pending_payment" : "confirmed";
      const [b] = await tx<{ id: string }[]>`insert into bookings (tenant_id, contact_id, lead_id, type, starts_at, ends_at, status, topic)
        values (app_tenant(), ${contactId}, ${leadId}, ${d.type}, ${start}, ${end}, ${status}, ${d.topic || null}) returning id`;
      if (amount > 0 && d.payWith === "mpesa" && msisdn) {
        const pay = await requestMpesaPayment(tx, { purpose: `booking:${d.type}`, reference: `ELANS-${b.id.slice(0, 6).toUpperCase()}`, amount, phone: msisdn, idempotencyKey: `booking:${b.id}` });
        await tx`update bookings set payment_id = ${pay.paymentId} where id = ${b.id}`;
      } else if (amount > 0 && d.payWith === "invoice") {
        await queueMessage(tx, { channel: "email", to: "team@elans", subject: `Invoice requested for ${meta.name}`, body: `${d.organisation} (${d.email}) requested an invoice for booking ${b.id}.` });
      } else {
        await queueMessage(tx, { channel: "email", to: d.email, subject: `Your ${meta.name} is confirmed`, body: `Hello ${d.name},\n\nYour ${meta.name} is booked for ${start.toUTCString()}. We will send a meeting link before the call.\n\nThe Elans team` });
      }
      return b.id;
    });
    return { ok: true, bookingId };
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes("bookings_slot_unique")) return { ok: false, message: "Someone has just taken that slot. Please pick another.", field: "slot" };
    console.error(e);
    return { ok: false, message: "We could not complete the booking right now. Please try again." };
  }
}

export async function bookingStatus(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return internal(async (tx) => {
    const [b] = await tx<{ id: string; type: string; starts_at: Date; ends_at: Date; status: string; payment_status: string | null; amount: number | null; provider: string | null; message: string | null }[]>`
      select b.id, b.type, b.starts_at, b.ends_at, b.status, p.status as payment_status, p.amount, p.provider, p.raw->'request'->>'message' as message
      from bookings b left join payments p on p.id = b.payment_id where b.id = ${id}`;
    return b ?? null;
  }).catch(() => null);
}
