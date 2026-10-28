import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as OTPAuth from "otpauth";
import { withDb, DEMO_TENANT_ID, INTERNAL_TENANT_ID, type Tx } from "@/lib/db";
import { randomToken, sha256, verifyPassword } from "@/lib/security";

export const SESSION_COOKIE = "elans_session";
export const TENANT_COOKIE = "elans_tenant";
const SESSION_HOURS = 12;

export type StaffRole = "admin" | "content_editor" | "consultant" | "engineer" | "support";
export type MemberRole = "owner" | "admin" | "approver" | "member" | "viewer";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  staffRole: StaffRole | null;
  mfaEnabled: boolean;
  mfaPassed: boolean;
  memberships: { tenantId: string; tenantName: string; kind: string; role: MemberRole }[];
  sessionId: string;
}

const system = <T,>(fn: (tx: Tx) => Promise<T>) => withDb({ system: true }, fn);

export async function authenticate(email: string, password: string) {
  return system(async (tx) => {
    const [u] = await tx<{ id: string; password_hash: string; mfa_enabled: boolean; staff_role: string | null }[]>`
      select id, password_hash, mfa_enabled, staff_role from users where lower(email) = lower(${email})`;
    // Always run a hash comparison so timing does not reveal whether the email exists.
    const ok = verifyPassword(password, u?.password_hash ?? "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86));
    return ok && u ? u : null;
  });
}

export async function startSession(userId: string, mfaPassed: boolean, meta: { ip?: string; ua?: string } = {}) {
  const token = randomToken();
  await system(async (tx) => {
    await tx`insert into sessions (id, user_id, mfa_passed, expires_at, ip, user_agent)
      values (${sha256(token)}, ${userId}, ${mfaPassed}, now() + ${SESSION_HOURS + " hours"}::interval, ${meta.ip ?? null}, ${meta.ua ?? null})`;
    await tx`update users set last_login_at = now() where id = ${userId}`;
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function markMfaPassed(sessionId: string) {
  await system((tx) => tx`update sessions set mfa_passed = true where id = ${sessionId}`);
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await system((tx) => tx`delete from sessions where id = ${sha256(token)}`);
  jar.delete(SESSION_COOKIE);
  jar.delete(TENANT_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await system(async (tx) => {
      const [row] = await tx<{ session_id: string; mfa_passed: boolean; id: string; email: string; name: string; staff_role: StaffRole | null; mfa_enabled: boolean }[]>`
        select s.id as session_id, s.mfa_passed, u.id, u.email, u.name, u.staff_role, u.mfa_enabled
        from sessions s join users u on u.id = s.user_id
        where s.id = ${sha256(token)} and s.expires_at > now()`;
      if (!row) return null;
      const memberships = await tx<{ tenant_id: string; name: string; kind: string; role: MemberRole }[]>`
        select m.tenant_id, t.name, t.kind, m.role from memberships m join tenants t on t.id = m.tenant_id
        where m.user_id = ${row.id} order by t.kind = 'demo', t.name`;
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        staffRole: row.staff_role,
        mfaEnabled: row.mfa_enabled,
        mfaPassed: row.mfa_passed,
        sessionId: row.session_id,
        memberships: memberships.map((m) => ({ tenantId: m.tenant_id, tenantName: m.name, kind: m.kind, role: m.role })),
      };
    });
  } catch {
    return null;
  }
}

// ── MFA (TOTP) ──
export function totpFor(email: string, secretB32: string) {
  return new OTPAuth.TOTP({ issuer: "Elans", label: email, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secretB32) });
}
export function newTotpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}
export function verifyTotp(email: string, secretB32: string, code: string) {
  const delta = totpFor(email, secretB32).validate({ token: code.replace(/\s+/g, ""), window: 1 });
  return delta !== null;
}
export async function getMfaSecret(userId: string) {
  return system(async (tx) => {
    const [r] = await tx<{ mfa_secret: string | null; email: string }[]>`select mfa_secret, email from users where id = ${userId}`;
    return r;
  });
}
export async function setMfaSecret(userId: string, secretB32: string | null, enabled: boolean) {
  await system((tx) => tx`update users set mfa_secret = ${secretB32}, mfa_enabled = ${enabled} where id = ${userId}`);
}

// ── Guards ──
/** Ops console: Elans staff with a completed MFA challenge. */
export async function requireStaff(roles?: StaffRole[]): Promise<SessionUser> {
  const u = await currentUser();
  if (!u || !u.staffRole) redirect("/ops/login");
  if (!u.mfaPassed) redirect(u.mfaEnabled ? "/ops/login/mfa" : "/ops/login/enrol");
  if (roles && !roles.includes(u.staffRole)) redirect("/ops?denied=1");
  return u;
}

/** Client portal: a member of a client (or demo) tenant. Owners/admins of real tenants must pass MFA. */
export async function requireClient(): Promise<{ user: SessionUser; tenantId: string; tenantName: string; role: MemberRole; isDemo: boolean }> {
  const u = await currentUser();
  if (!u) redirect("/portal/login");
  const clientTenants = u.memberships.filter((m) => m.kind === "client" || m.kind === "demo");
  if (!clientTenants.length) redirect("/portal/login?error=no-access");
  const chosen = (await cookies()).get(TENANT_COOKIE)?.value;
  const m = clientTenants.find((t) => t.tenantId === chosen) ?? clientTenants[0];
  const isDemo = m.kind === "demo";
  if (!isDemo && (m.role === "owner" || m.role === "admin") && !u.mfaPassed) redirect(u.mfaEnabled ? "/portal/login/mfa" : "/portal/login/enrol");
  return { user: u, tenantId: m.tenantId, tenantName: m.tenantName, role: m.role, isDemo };
}

export const canApprove = (role: MemberRole) => role === "owner" || role === "admin" || role === "approver";
export const canAdmin = (role: MemberRole) => role === "owner" || role === "admin";

export { INTERNAL_TENANT_ID, DEMO_TENANT_ID };
