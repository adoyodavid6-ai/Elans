"use server";

import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { authenticate, currentUser, endSession, getMfaSecret, markMfaPassed, newTotpSecret, setMfaSecret, startSession, totpFor, verifyTotp } from "@/lib/auth";
import { clientIp, userAgent } from "@/lib/request";
import { rateLimit } from "@/lib/security";
import { withDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/forms/fields";

type Area = "ops" | "portal";

export async function login(area: Area, _: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000).ok || !rateLimit(`login:${email.toLowerCase()}`, 8, 15 * 60_000).ok) return { ok: false, message: "Too many attempts. Please wait 15 minutes." };
  const u = await authenticate(email, password).catch(() => null);
  if (!u || (area === "ops" && !u.staff_role)) return { ok: false, message: "Email or password is incorrect." };
  await startSession(u.id, false, { ip, ua: await userAgent() });
  redirect(`/${area}/login/${u.mfa_enabled ? "mfa" : "enrol"}`);
}

export async function verifyMfa(area: Area, _: FormState, fd: FormData): Promise<FormState> {
  const u = await currentUser();
  if (!u) redirect(`/${area}/login`);
  const ip = await clientIp();
  if (!rateLimit(`mfa:${u.id}`, 6, 10 * 60_000).ok) return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  const s = await getMfaSecret(u.id);
  if (!s?.mfa_secret || !verifyTotp(s.email, s.mfa_secret, String(fd.get("code") ?? ""))) return { ok: false, message: "That code is not valid. Check the time on your phone and try again." };
  await markMfaPassed(u.sessionId);
  await logAuth(u.id, u.memberships[0]?.tenantId, "auth.mfa_passed", ip);
  redirect(area === "ops" ? "/ops" : "/portal");
}

/** Generates (or re-uses) a pending secret and returns a QR code for enrolment. */
export async function enrolmentDetails() {
  const u = await currentUser();
  if (!u) return null;
  let s = await getMfaSecret(u.id);
  if (!s?.mfa_secret || u.mfaEnabled) {
    if (u.mfaEnabled) return { enrolled: true as const };
    await setMfaSecret(u.id, newTotpSecret(), false);
    s = await getMfaSecret(u.id);
  }
  const uri = totpFor(s!.email, s!.mfa_secret!).toString();
  return { enrolled: false as const, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#35271F", light: "#FFFFFF" } }), secret: s!.mfa_secret!, email: s!.email };
}

export async function confirmEnrolment(area: Area, _: FormState, fd: FormData): Promise<FormState> {
  const u = await currentUser();
  if (!u) redirect(`/${area}/login`);
  const s = await getMfaSecret(u.id);
  if (!s?.mfa_secret || !verifyTotp(s.email, s.mfa_secret, String(fd.get("code") ?? ""))) return { ok: false, message: "That code did not match. Make sure you scanned the latest QR code." };
  await setMfaSecret(u.id, s.mfa_secret, true);
  await markMfaPassed(u.sessionId);
  await logAuth(u.id, u.memberships[0]?.tenantId, "auth.mfa_enrolled", await clientIp());
  redirect(area === "ops" ? "/ops" : "/portal");
}

export async function logout(area: Area) {
  await endSession();
  redirect(`/${area}/login`);
}

async function logAuth(userId: string, tenantId: string | undefined, action: string, ip: string) {
  if (!tenantId) return;
  await withDb({ tenantId, userId }, (tx) => audit(tx, { tenantId, actorId: userId, action, meta: { ip } })).catch(() => {});
}
