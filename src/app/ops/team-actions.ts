"use server";

import { revalidatePath } from "next/cache";
import { requireSuper } from "@/lib/auth";
import { superAdminEmail } from "@/lib/ops/super-actions";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { hashPassword, randomToken } from "@/lib/security";
import { audit } from "@/lib/audit";

export async function addStaff(_: unknown, fd: FormData): Promise<{ ok: boolean; message: string }> {
  const u = await requireSuper();
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  // Everyone added here is an Admin; Super Admin is reserved for the configured owner account.
  const role = email === superAdminEmail() ? "super_admin" : "admin";
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a name and a valid email." };
  const temp = randomToken(12);
  try {
    await withDb({ system: true }, async (tx) => {
      const [nu] = await tx<{ id: string }[]>`insert into users (email, name, password_hash, staff_role) values (${email}, ${name}, ${hashPassword(temp)}, ${role}) returning id`;
      await tx`insert into memberships (tenant_id, user_id, role) values (${INTERNAL_TENANT_ID}, ${nu.id}, 'member')`;
    });
    await withDb({ tenantId: INTERNAL_TENANT_ID, userId: u.id }, (tx) => audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "staff.added", meta: { email, role } }));
  } catch {
    return { ok: false, message: "A user with that email may already exist." };
  }
  revalidatePath("/ops/team");
  return { ok: true, message: `Created. Share this one-time password securely: ${temp}  (they must set up two-step verification at first sign-in).` };
}
