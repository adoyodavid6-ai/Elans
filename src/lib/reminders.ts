import "server-only";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { channelReady, queueMessage } from "@/lib/outbox";

/** Minutes before a session that the reminder goes out. */
export const REMINDER_MINUTES = 45;
const TYPE_LABEL: Record<string, string> = { strategy: "Strategy Session", discovery: "Discovery Call", support: "Support session", diagnostic: "Diagnostic" };
const eat = (d: Date) => d.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });

/**
 * Sends one reminder per confirmed session, 45 minutes before it starts, to the client (email, plus SMS when
 * configured and a phone number is on file) and to every staff member. Run every few minutes by the cron
 * endpoint; a late run still reminds any session that has not started yet. Each booking is reminded once.
 */
export async function sendDueReminders(): Promise<{ reminded: number }> {
  const team = await withDb({ system: true }, (tx) => tx<{ email: string }[]>`select email from users where staff_role is not null`);
  const reminded = await withDb({ tenantId: INTERNAL_TENANT_ID, system: true }, async (tx) => {
    const due = await tx<{ id: string; type: string; starts_at: Date; ends_at: Date; topic: string | null; meeting_link: string | null; name: string | null; email: string | null; phone: string | null; organisation: string | null }[]>`
      select b.id, b.type, b.starts_at, b.ends_at, b.topic, b.meeting_link, c.name, c.email, c.phone, c.organisation
      from bookings b left join contacts c on c.id = b.contact_id
      where b.status = 'confirmed' and b.reminded_at is null and b.starts_at > now() and b.starts_at <= now() + make_interval(mins => ${REMINDER_MINUTES})
      order by b.starts_at for update of b skip locked`;
    for (const b of due) {
      const label = TYPE_LABEL[b.type] ?? "session";
      const mins = Math.max(1, Math.round((b.starts_at.getTime() - Date.now()) / 60000));
      const link = b.meeting_link ? `Join here: ${b.meeting_link}` : "We'll share the meeting link shortly if you don't have it yet.";
      if (b.email) await queueMessage(tx, { channel: "email", to: b.email, subject: `Reminder: your ${label} starts at ${time(b.starts_at)} (EAT)`, body: `Hello ${b.name ?? "there"},\n\nA quick reminder that your ${label} with Elans starts in about ${mins} minutes, on ${eat(b.starts_at)} (EAT).\n\n${link}\n\nIf you need to reschedule, just reply to this email.\n\nThe Elans team`, meta: { kind: "session.reminder", bookingId: b.id } });
      if (b.phone && channelReady("sms")) await queueMessage(tx, { channel: "sms", to: b.phone, body: `Elans: your ${label} starts at ${time(b.starts_at)} EAT (in ~${mins} min). ${b.meeting_link ? `Join: ${b.meeting_link}` : "Meeting link to follow."}`, meta: { kind: "session.reminder", bookingId: b.id } });
      for (const t of team) await queueMessage(tx, { channel: "email", to: t.email, subject: `Starting in ${mins} min: ${label} with ${b.organisation ?? b.name ?? "a client"}`, body: `${label} with ${b.name ?? "a client"}${b.organisation ? ` (${b.organisation})` : ""} starts at ${time(b.starts_at)} EAT.\n${b.topic ? `\nTopic: ${b.topic}\n` : ""}${b.meeting_link ? `\nMeeting link: ${b.meeting_link}\n` : "\nNo meeting link saved yet: add one in the console so the client gets it.\n"}\nCalendar: ${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/ops/bookings`, meta: { kind: "session.reminder.team", bookingId: b.id } });
      await tx`update bookings set reminded_at = now() where id = ${b.id}`;
    }
    return due.length;
  });
  return { reminded };
}
