import "server-only";
import { withDb, type Tx } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

/**
 * Just-in-time, audited access for Elans staff to a client tenant (DECISIONS D-007).
 * Staff state a reason; a 4-hour grant is created (self-approved for operational roles) and logged.
 */
export async function activeGrant(staff: SessionUser, tenantId: string) {
  return withDb({ tenantId, userId: staff.id }, async (tx) => {
    const [g] = await tx<{ id: string; reason: string; expires_at: Date }[]>`
      select id, reason, expires_at from access_grants where tenant_id = ${tenantId} and staff_user_id = ${staff.id} and expires_at > now() order by expires_at desc limit 1`;
    return g ?? null;
  });
}

export async function createGrant(staff: SessionUser, tenantId: string, reason: string, hours = 4) {
  return withDb({ tenantId, userId: staff.id }, async (tx) => {
    const [g] = await tx<{ id: string }[]>`insert into access_grants (tenant_id, staff_user_id, reason, approved_by, expires_at)
      values (${tenantId}, ${staff.id}, ${reason.slice(0, 300)}, ${staff.id}, now() + ${`${hours} hours`}::interval) returning id`;
    await audit(tx, { tenantId, actorId: staff.id, actorLabel: `staff:${staff.email}`, action: "access_grant.created", entity: "access_grant", entityId: g.id, meta: { reason, hours } });
    return g.id;
  });
}

/** Runs `fn` in a client tenant's context only if the staff member holds an active grant; every call is audited. */
export async function withClientAccess<T>(staff: SessionUser, tenantId: string, action: string, fn: (tx: Tx) => Promise<T>): Promise<T | null> {
  const g = await activeGrant(staff, tenantId);
  if (!g) return null;
  return withDb({ tenantId, userId: staff.id, staffRole: staff.staffRole }, async (tx) => {
    const r = await fn(tx);
    if (action.startsWith("write:")) await audit(tx, { tenantId, actorId: staff.id, actorLabel: `staff:${staff.email}`, action: action.slice(6), meta: { grant: g.id } });
    return r;
  });
}
