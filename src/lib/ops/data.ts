import "server-only";
import { internal } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

/** Queries against the Elans internal tenant (pre-sale data), executed with the staff member's identity. */
export function asStaff<T>(u: SessionUser, fn: Parameters<typeof internal<T>>[0]) {
  return internal(fn, { userId: u.id, staffRole: u.staffRole });
}

export async function navCounts(u: SessionUser) {
  return asStaff(u, async (tx) => {
    const [r] = await tx<{ leads: number; handoffs: number; assessments: number; bookings: number }[]>`
      select
        (select count(*)::int from leads where stage = 'new') as leads,
        (select count(*)::int from conversations where status = 'handed_off') as handoffs,
        (select count(*)::int from assessments where state = 'submitted') as assessments,
        (select count(*)::int from bookings where status in ('confirmed','pending_payment') and starts_at > now()) as bookings`;
    const [q] = await tx<{ reviews: number; tickets: number; incidents: number }[]>`
      select (select count(*)::int from ops_review_queue()) as reviews, (select count(*)::int from ops_ticket_queue()) as tickets, (select count(*)::int from ops_incident_queue()) as incidents`;
    return { ...r, ...q };
  }).catch(() => ({ leads: 0, handoffs: 0, assessments: 0, bookings: 0, reviews: 0, tickets: 0, incidents: 0 }));
}

export const LEAD_STAGES = ["new", "contacted", "qualified", "discovery", "diagnostic", "proposal", "won", "lost"] as const;
export const OPP_STAGES = [
  { key: "discovery", label: "Discover" },
  { key: "diagnostic", label: "Diagnose" },
  { key: "design", label: "Design" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

export function relTime(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const abs = Math.abs(ms);
  const fmt = (n: number, u: string) => `${n} ${u}${n === 1 ? "" : "s"}`;
  const s = abs < 3600_000 ? fmt(Math.max(1, Math.round(abs / 60_000)), "min") : abs < 86400_000 ? fmt(Math.round(abs / 3600_000), "hour") : fmt(Math.round(abs / 86400_000), "day");
  return ms >= 0 ? `${s} ago` : `in ${s}`;
}
