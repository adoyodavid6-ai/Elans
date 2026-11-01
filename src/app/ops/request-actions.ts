"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSuper, requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { queueMessage } from "@/lib/outbox";
import { INTERNAL_TENANT_ID } from "@/lib/db";
import { superAdminEmail } from "@/lib/ops/super-actions";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** An admin asks the super admin to do something beyond admin access ("Ask Super Admin"). */
export async function requestSuper(fd: FormData) {
  const u = await requireStaff();
  const kind = String(fd.get("kind") ?? "").slice(0, 60);
  const title = String(fd.get("title") ?? "").trim().slice(0, 200);
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000);
  const link = String(fd.get("link") ?? "");
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(String(fd.get("payload") ?? "{}")); } catch { /* ignore malformed payload */ }
  if (!kind || !title) return;
  await asStaff(u, async (tx) => {
    const [dup] = await tx<{ id: string }[]>`select id from staff_requests where kind = ${kind} and title = ${title} and status = 'pending' and requested_by = ${u.id}`;
    if (dup) return;
    const [r] = await tx<{ id: string }[]>`insert into staff_requests (tenant_id, kind, title, note, payload, link, requested_by, requested_label)
      values (app_tenant(), ${kind}, ${title}, ${note || null}, ${tx.json(payload as never)}, ${link.startsWith("/ops") ? link : null}, ${u.id}, ${u.name}) returning id`;
    await queueMessage(tx, { channel: "email", to: superAdminEmail(), subject: `Request from ${u.name}: ${title}`, body: `${u.name} (${u.email}) asked for: ${title}${note ? `\n\nNote: ${note}` : ""}\n\nReview it: ${siteUrl()}/ops/requests` });
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "request.created", entity: "staff_request", entityId: r.id, meta: { kind } });
  });
  await flash("Sent to the Super Admin. You'll see the outcome under Requests.");
  if (link.startsWith("/ops")) revalidatePath(link);
  revalidatePath("/ops/requests");
}

/** Super admin: decline, or mark done after doing it themselves. */
export async function decideRequest(id: string, decision: "declined" | "done", fd: FormData) {
  const u = await requireStaff();
  if (!isSuper(u)) redirect("/ops/requests");
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000);
  await asStaff(u, async (tx) => {
    const [r] = await tx<{ requested_by: string | null; title: string }[]>`update staff_requests set status = ${decision}, decided_label = ${u.name}, decision_note = ${note || null}, decided_at = now() where id = ${id} and status = 'pending' returning requested_by, title`;
    if (!r) return;
    const [who] = r.requested_by ? await tx<{ email: string }[]>`select email from ops_staff_directory() where id = ${r.requested_by}` : [];
    if (who) await queueMessage(tx, { channel: "email", to: who.email, subject: `Your request was ${decision === "done" ? "completed" : "declined"}: ${r.title}`, body: `${u.name} ${decision === "done" ? "completed" : "declined"} your request "${r.title}".${note ? `\n\nNote: ${note}` : ""}` });
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: `request.${decision}`, entity: "staff_request", entityId: id });
  });
  await flash(decision === "done" ? "Marked as done" : "Request declined");
  revalidatePath("/ops/requests");
}

/** Super admin: approve and carry out a request in one step (for actions that can run without more input). */
export async function approveRequest(id: string) {
  const u = await requireStaff();
  if (!isSuper(u)) redirect("/ops/requests");
  const r = await asStaff(u, async (tx) => (await tx<{ kind: string; payload: Record<string, unknown>; status: string; title: string }[]>`select kind, payload, status, title from staff_requests where id = ${id}`)[0]);
  if (!r || r.status !== "pending") { await flash("Already handled.", "info"); revalidatePath("/ops/requests"); return; }
  const { performSuperAction, PERFORMABLE } = await import("@/lib/ops/super-actions");
  if (!PERFORMABLE.includes(r.kind)) { await flash("This one needs doing by hand: open it, then mark it done.", "info"); return; }
  const res = await performSuperAction(u, r.kind, r.payload);
  if (res.ok) {
    await asStaff(u, (tx) => tx`update staff_requests set status = 'approved', decided_label = ${u.name}, decision_note = ${res.message}, decided_at = now() where id = ${id}`);
  }
  await flash(res.ok ? `Approved and done: ${res.message}` : `Couldn't complete it: ${res.message}`, res.ok ? "success" : "error");
  revalidatePath("/ops/requests");
}
