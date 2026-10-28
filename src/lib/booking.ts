import "server-only";
import { internal } from "@/lib/db";

/** Session types and slot generation (EAT, weekdays). Prices come from the catalogue price points. */
export const SESSION_TYPES = {
  discovery: { name: "Discovery Call", minutes: 20, priceKey: "session.discovery", summary: "A short call to understand your situation and whether we can help. Qualification only, no consulting." },
  strategy: { name: "Strategy Session", minutes: 90, priceKey: "session.strategy", summary: "60–90 minutes with an Elans consultant on your processes and priorities, ending with a written action list." },
  support: { name: "Client Support Session", minutes: 60, priceKey: "session.support", summary: "For existing clients beyond their package allowance." },
} as const;
export type SessionType = keyof typeof SESSION_TYPES;

const SLOT_HOURS: Record<SessionType, number[]> = {
  discovery: [9, 10, 11, 12, 14, 15, 16],
  strategy: [9.5, 14],
  support: [10.5, 15.5],
};

/** Returns ISO start times for the next `days` weekdays, excluding booked slots and anything within 18 hours. */
export async function availableSlots(type: SessionType, days = 14): Promise<string[]> {
  const now = Date.now();
  const out: Date[] = [];
  const startOfTodayEat = new Date(Math.floor((now + 3 * 3600_000) / 86400_000) * 86400_000 - 3 * 3600_000);
  for (let d = 0; d < days + 6 && out.length < 400; d++) {
    const dayStart = new Date(startOfTodayEat.getTime() + d * 86400_000);
    const dow = new Date(dayStart.getTime() + 3 * 3600_000).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    for (const h of SLOT_HOURS[type]) {
      const t = new Date(dayStart.getTime() + h * 3600_000);
      if (t.getTime() > now + 18 * 3600_000) out.push(t);
    }
  }
  let taken = new Set<string>();
  try {
    taken = await internal(async (tx) => {
      const rows = await tx<{ starts_at: Date }[]>`select starts_at from bookings where starts_at > now() and status in ('pending_payment','confirmed')`;
      return new Set(rows.map((r) => r.starts_at.toISOString()));
    });
  } catch {
    /* database unavailable: show all slots; booking will fail gracefully */
  }
  return out.filter((t) => !taken.has(t.toISOString())).slice(0, 60).map((t) => t.toISOString());
}

export function formatEat(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) {
  return new Date(iso).toLocaleString("en-GB", { ...opts, timeZone: "Africa/Nairobi" });
}
