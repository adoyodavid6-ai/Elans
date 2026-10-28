import { bookingStatus } from "@/app/actions/booking";
import { SESSION_TYPES, type SessionType } from "@/lib/booking";

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await bookingStatus(id);
  if (!b || b.status !== "confirmed") return new Response("Not found", { status: 404 });
  const name = SESSION_TYPES[b.type as SessionType]?.name ?? "Elans session";
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elans//Sessions//EN", "BEGIN:VEVENT", `UID:${b.id}@elans`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(b.starts_at)}`, `DTEND:${fmt(b.ends_at)}`, `SUMMARY:${name} with Elans`, "DESCRIPTION:A video link will be emailed before the session.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="elans-${b.type}.ics"` } });
}
