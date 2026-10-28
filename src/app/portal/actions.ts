"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { portal } from "@/lib/portal";
import { canAdmin, canApprove, startSession } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { hashPassword, randomToken, sha256 } from "@/lib/security";
import { audit } from "@/lib/audit";
import { queueMessage } from "@/lib/outbox";
import { loadInstance } from "@/lib/runtime/engine";
import { applyApprovalDecision, applyReviewDecision } from "@/lib/runtime/review";
import { processInvoice } from "@/lib/solutions/etims/workflow";
import { generateInvoices } from "@/lib/solutions/etims/samples";
import { importStatement, type StatementRow } from "@/lib/solutions/recon/workflow";
import { converseRespond } from "@/lib/solutions/converse/agent";
import { normaliseMsisdn } from "@/lib/integrations/mpesa";
import { requestMpesaPayment } from "@/lib/payments";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/security";

const label = (c: { user: { name: string }; isDemo: boolean }) => `${c.user.name}${c.isDemo ? " (demo)" : ""}`;

// ───────────── Invites ─────────────
export async function acceptInvite(token: string, fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (name.length < 2 || password.length < 12) redirect(`/portal/invite/${token}?error=1`);
  const userId = await withDb({ system: true }, async (tx) => {
    const [inv] = await tx<{ id: string; tenant_id: string; email: string; role: string }[]>`select id, tenant_id, email, role from invites where token_hash = ${sha256(token)} and accepted_at is null and expires_at > now() for update`;
    if (!inv) return null;
    const [existing] = await tx<{ id: string }[]>`select id from users where lower(email) = lower(${inv.email})`;
    const uid = existing?.id ?? (await tx<{ id: string }[]>`insert into users (email, name, password_hash) values (${inv.email}, ${name}, ${hashPassword(password)}) returning id`)[0].id;
    await tx`insert into memberships (tenant_id, user_id, role) values (${inv.tenant_id}, ${uid}, ${inv.role}) on conflict do nothing`;
    await tx`update invites set accepted_at = now() where id = ${inv.id}`;
    return uid;
  });
  if (!userId) redirect(`/portal/invite/${token}`);
  await startSession(userId, false, { ip: await clientIp() });
  redirect("/portal/login/enrol");
}

// ───────────── eTIMS ─────────────
const MAX_UPLOAD = 5 * 1024 * 1024;

export async function uploadInvoices(instanceId: string, fd: FormData) {
  const c = await portal();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
  for (const file of files) {
    if (file.size > MAX_UPLOAD) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    await c.db(async (tx) => {
      const inst = await loadInstance(tx, instanceId);
      if (!inst || inst.solution_slug !== "etims-compliance-reconciliation") return;
      const [doc] = await tx<{ id: string }[]>`insert into documents (tenant_id, name, kind, mime, size_bytes, content, uploaded_by) values (${c.tenantId}, ${file.name.slice(0, 200)}, 'purchase_invoice', ${mime}, ${file.size}, ${buf}, ${label(c)}) returning id`;
      const base = { source: "upload" as const, filename: file.name, documentId: doc.id };
      if (mime.startsWith("text/") || file.name.endsWith(".txt")) await processInvoice(tx, inst, { ...base, text: buf.toString("utf8") });
      else if (mime === "application/pdf") await processInvoice(tx, inst, { ...base, pdf: buf.toString("base64") });
      else if (["image/png", "image/jpeg", "image/webp"].includes(mime)) await processInvoice(tx, inst, { ...base, image: { mediaType: mime as "image/png", data: buf.toString("base64") } });
    });
  }
  revalidatePath(`/portal/automations/${instanceId}`);
}

/** Demo helper: simulates a supplier invoice forwarded on WhatsApp (synthetic sample, labelled). */
export async function simulateInvoiceIntake(instanceId: string, fd: FormData) {
  const c = await portal();
  const custom = String(fd.get("text") ?? "").trim();
  await c.db(async (tx) => {
    const inst = await loadInstance(tx, instanceId);
    if (!inst) return;
    if (custom) {
      await processInvoice(tx, inst, { source: "whatsapp", filename: "whatsapp-message.txt", text: custom.slice(0, 6000) });
      return;
    }
    const { invoices } = generateInvoices();
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from etims_invoices where engine_instance_id = ${instanceId}`;
    const sample = invoices[(n + 7) % invoices.length];
    await processInvoice(tx, inst, { source: "whatsapp", filename: `${sample.id}.txt (synthetic)`, text: sample.text });
  });
  revalidatePath(`/portal/automations/${instanceId}`);
}

// ───────────── Reconciliation ─────────────
export async function importStatementCsv(instanceId: string, fd: FormData) {
  const c = await portal();
  const csv = String(fd.get("csv") ?? "").trim();
  const rows: StatementRow[] = csv
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(",").map((x) => x.trim()))
    .filter((p) => p.length >= 3 && p[0])
    .slice(0, 500)
    .map(([txnRef, txnAt, amount, payerName, payerPhone, ...ref]) => ({ txnRef, txnAt: txnAt || new Date().toISOString(), amount: Number(amount), payerName, payerPhone, reference: ref.join(",") }))
    .filter((r) => Number.isFinite(r.amount) && r.amount > 0);
  if (!rows.length) return;
  await c.db(async (tx) => {
    const inst = await loadInstance(tx, instanceId);
    if (inst) await importStatement(tx, inst, rows, "csv");
  });
  revalidatePath(`/portal/automations/${instanceId}`);
}

// ───────────── Automation controls ─────────────
export async function setKillSwitch(instanceId: string, on: boolean) {
  const c = await portal();
  if (!canApprove(c.role)) return;
  await c.db(async (tx) => {
    await tx`update engine_instances set kill_switch = ${on} where id = ${instanceId}`;
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: on ? "automation.kill_switch_on" : "automation.kill_switch_off", entity: "engine_instance", entityId: instanceId });
  });
  revalidatePath(`/portal/automations/${instanceId}`);
  revalidatePath("/portal/automations");
}

export async function setAutonomy(instanceId: string, actionType: string, value: "approve" | "auto") {
  const c = await portal();
  if (!canAdmin(c.role) && !c.isDemo) return;
  await c.db(async (tx) => {
    await tx`update engine_instances set autonomy = autonomy || ${tx.json({ [actionType]: value })} where id = ${instanceId}`;
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: "automation.autonomy_changed", entity: "engine_instance", entityId: instanceId, meta: { actionType, value } });
  });
  revalidatePath(`/portal/automations/${instanceId}`);
}

export async function setAccountKillSwitch(on: boolean) {
  const c = await portal();
  if (c.role !== "owner" && !c.isDemo) return;
  await c.db(async (tx) => {
    await tx`select set_tenant_kill_switch(${on})`;
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: on ? "account.kill_switch_on" : "account.kill_switch_off" });
  });
  revalidatePath("/portal", "layout");
}

// ───────────── Approvals & reviews ─────────────
export async function decideApproval(approvalId: string, approve: boolean, fd: FormData) {
  const c = await portal();
  if (!canApprove(c.role)) return;
  const edited = String(fd.get("message") ?? "").trim();
  await c.db(async (tx) => {
    await applyApprovalDecision(tx, approvalId, { approve, by: label(c), editedMessage: edited || undefined });
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: approve ? "approval.approved" : "approval.rejected", entity: "approval", entityId: approvalId });
  });
  revalidatePath("/portal/approvals");
  revalidatePath("/portal");
}

export async function decideClientReview(itemId: string, fd: FormData) {
  const c = await portal();
  if (!canApprove(c.role)) return;
  const decision = String(fd.get("decision") ?? "accept") as "accept" | "correct" | "reject";
  const receivableId = String(fd.get("receivableId") ?? "");
  await c.db(async (tx) => {
    await applyReviewDecision(tx, itemId, { decision, correction: receivableId ? JSON.stringify({ receivableId }) : undefined, by: label(c) });
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: "review.decided", entity: "review_item", entityId: itemId, meta: { decision } });
  });
  revalidatePath("/portal/approvals");
}

export async function decideContent(itemId: string, approve: boolean, fd: FormData) {
  const c = await portal();
  if (!canApprove(c.role)) return;
  const feedback = String(fd.get("feedback") ?? "").slice(0, 1000);
  await c.db(async (tx) => {
    await tx`update studio_items set status = ${approve ? "approved" : "changes_requested"}, feedback = ${feedback || null} where id = ${itemId} and status = 'awaiting_client'`;
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: approve ? "content.approved" : "content.changes_requested", entity: "studio_item", entityId: itemId });
  });
  revalidatePath("/portal/approvals");
  revalidatePath("/portal/campaigns");
}

// ───────────── Conversations ─────────────
export async function simulateCustomerMessage(instanceId: string, fd: FormData) {
  const c = await portal();
  const message = String(fd.get("message") ?? "").trim().slice(0, 1000);
  let conversationId = String(fd.get("conversationId") ?? "") || null;
  if (!message) return;
  if (!rateLimit(`wa-sim:${c.user.id}`, 60, 10 * 60_000).ok) return;
  conversationId = await c.db(async (tx) => {
    const inst = await loadInstance(tx, instanceId);
    if (!inst) return null;
    let convId = conversationId;
    if (!convId) {
      const [conv] = await tx<{ id: string }[]>`insert into conversations (tenant_id, engine_instance_id, channel, visitor_ref, meta) values (${c.tenantId}, ${instanceId}, 'whatsapp', ${`+2547${Math.floor(10000000 + Math.random() * 89999999)}`}, ${tx.json({ simulated: true })}) returning id`;
      convId = conv.id;
      await tx`insert into usage_events (tenant_id, meter, quantity, cost) values (${c.tenantId}, 'wa_conversation', 1, 0)`;
    }
    await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (${c.tenantId}, ${convId}, 'in', 'customer', ${message}, ${tx.json({ untrusted: true })})`;
    const [conv] = await tx<{ status: string }[]>`select status from conversations where id = ${convId}`;
    if (conv.status === "handed_off") return convId;
    if (inst.kill_switch) {
      await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (${c.tenantId}, ${convId}, 'out', 'system', 'Agent paused (kill switch on). Message queued for the team.', '{}')`;
      return convId;
    }
    const reply = await converseRespond(tx, inst, convId!, message);
    await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (${c.tenantId}, ${convId}, 'out', 'agent', ${reply.body}, ${tx.json({ intent: reply.intent })})`;
    if (reply.pendingOrder !== undefined) await tx`update conversations set meta = meta || jsonb_build_object('pendingOrder', ${tx.json((reply.pendingOrder ?? null) as never)}::jsonb) where id = ${convId}`;
    if (reply.handover) {
      await tx`update conversations set status = 'handed_off', resolution = 'handed_off', updated_at = now() where id = ${convId}`;
      await tx`insert into handoffs (tenant_id, conversation_id, reason) values (${c.tenantId}, ${convId}, ${reply.intent})`;
    } else if (reply.resolved) {
      await tx`update conversations set status = 'closed', resolution = 'resolved', updated_at = now() where id = ${convId}`;
      await tx`insert into usage_events (tenant_id, meter, quantity, cost) values (${c.tenantId}, 'resolved_conversation', 1, 0)`;
    } else await tx`update conversations set updated_at = now() where id = ${convId}`;
    return convId;
  });
  revalidatePath("/portal/conversations");
  if (conversationId) redirect(`/portal/conversations?c=${conversationId}`);
}

export async function staffReply(conversationId: string, fd: FormData) {
  const c = await portal();
  const body = String(fd.get("body") ?? "").trim().slice(0, 2000);
  if (!body) return;
  await c.db(async (tx) => {
    await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (${c.tenantId}, ${conversationId}, 'out', 'human', ${body}, ${tx.json({ staff: c.user.name })})`;
    await tx`update conversations set status = 'handed_off', assigned_to = ${c.user.id}, updated_at = now() where id = ${conversationId}`;
  });
  revalidatePath("/portal/conversations");
}

export async function releaseConversation(conversationId: string) {
  const c = await portal();
  await c.db((tx) => tx`update conversations set status = 'open', updated_at = now() where id = ${conversationId}`);
  revalidatePath("/portal/conversations");
}

// ───────────── Projects, support, documents ─────────────
export async function toggleTask(taskId: string) {
  const c = await portal();
  await c.db((tx) => tx`update onboarding_tasks set status = case when status = 'done' then 'todo' else 'done' end where id = ${taskId} and owner = 'client'`);
  revalidatePath("/portal/projects");
}

export async function createTicket(fd: FormData) {
  const c = await portal();
  const subject = String(fd.get("subject") ?? "").trim().slice(0, 200);
  const body = String(fd.get("body") ?? "").trim().slice(0, 4000);
  const priority = ["low", "normal", "high", "urgent"].includes(String(fd.get("priority"))) ? String(fd.get("priority")) : "normal";
  if (!subject || !body) return;
  const hours = { urgent: 2, high: 8, normal: 24, low: 72 }[priority as "normal"];
  await c.db(async (tx) => {
    const [t] = await tx<{ id: string }[]>`insert into tickets (tenant_id, subject, priority, sla_due_at, created_by, created_label) values (${c.tenantId}, ${subject}, ${priority}, now() + ${`${hours} hours`}::interval, ${c.user.id}, ${label(c)}) returning id`;
    await tx`insert into ticket_messages (tenant_id, ticket_id, author_label, body) values (${c.tenantId}, ${t.id}, ${label(c)}, ${body})`;
  });
  revalidatePath("/portal/support");
}

export async function replyToTicket(ticketId: string, fd: FormData) {
  const c = await portal();
  const body = String(fd.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return;
  await c.db(async (tx) => {
    await tx`insert into ticket_messages (tenant_id, ticket_id, author_label, body) values (${c.tenantId}, ${ticketId}, ${label(c)}, ${body})`;
    await tx`update tickets set status = 'open', updated_at = now() where id = ${ticketId}`;
  });
  revalidatePath("/portal/support");
}

export async function uploadDocument(fd: FormData) {
  const c = await portal();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size || file.size > MAX_UPLOAD) return;
  const kind = String(fd.get("kind") ?? "other").slice(0, 40);
  const buf = Buffer.from(await file.arrayBuffer());
  await c.db(async (tx) => {
    const [d] = await tx<{ id: string }[]>`insert into documents (tenant_id, name, kind, mime, size_bytes, content, uploaded_by) values (${c.tenantId}, ${file.name.slice(0, 200)}, ${kind}, ${file.type || "application/octet-stream"}, ${file.size}, ${buf}, ${label(c)}) returning id`;
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: "document.uploaded", entity: "document", entityId: d.id });
  });
  revalidatePath("/portal/documents");
}

// ───────────── Team, privacy, billing, profile ─────────────
export async function inviteMember(fd: FormData) {
  const c = await portal();
  if (!canAdmin(c.role) || c.isDemo) return;
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = ["admin", "approver", "member", "viewer"].includes(String(fd.get("role"))) ? String(fd.get("role")) : "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const token = randomToken(24);
  await c.db(async (tx) => {
    await tx`insert into invites (tenant_id, email, role, token_hash, expires_at, created_by) values (${c.tenantId}, ${email}, ${role}, ${sha256(token)}, now() + interval '14 days', ${label(c)})`;
    await queueMessage(tx, { channel: "email", to: email, subject: `${c.user.name} invited you to ${c.tenantName} on Elans`, body: `Accept your invitation: ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/invite/${token}` });
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: "member.invited", meta: { email, role } });
  });
  revalidatePath("/portal/team");
}

export async function createDpaRequest(fd: FormData) {
  const c = await portal();
  const type = ["access", "erasure", "correction", "objection", "export"].includes(String(fd.get("type"))) ? String(fd.get("type")) : "access";
  const subject = String(fd.get("subject") ?? "").trim().slice(0, 200);
  if (!subject) return;
  await c.db(async (tx) => {
    // Kenya DPA: respond to data-subject requests promptly; deadline tracked at 7 days for access, 14 otherwise (configurable policy).
    await tx`insert into dpa_requests (tenant_id, subject_ref, type, due_at, notes) values (${c.tenantId}, ${subject}, ${type}, now() + ${type === "access" ? "7 days" : "14 days"}::interval, ${String(fd.get("notes") ?? "").slice(0, 1000) || null})`;
    await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: label(c), action: "dpa_request.created", meta: { type } });
  });
  revalidatePath("/portal/privacy");
}

export async function payInvoice(invoiceId: string, fd: FormData) {
  const c = await portal();
  const phone = normaliseMsisdn(String(fd.get("phone") ?? ""));
  if (!phone) return;
  await c.db(async (tx) => {
    const [inv] = await tx<{ id: string; amount: number; number: string; status: string }[]>`select id, amount, number, status from invoices where id = ${invoiceId}`;
    if (!inv || inv.status === "paid") return;
    const r = await requestMpesaPayment(tx, { purpose: `invoice:${inv.number}`, reference: inv.number, amount: Number(inv.amount), phone, idempotencyKey: `invoice:${inv.id}:${Date.now()}` });
    await tx`update invoices set lines = lines || ${tx.json([{ paymentId: r.paymentId }] as never)} where id = ${inv.id}`;
    if (r.mode === "mock") {
      // Test mode: the demo settles immediately so the flow can be seen end to end.
      await tx`update invoices set status = 'paid', paid_at = now() where id = ${inv.id}`;
      await tx`update payments set status = 'succeeded', provider_ref = ${`TEST${Date.now().toString(36).toUpperCase()}`}, updated_at = now() where id = ${r.paymentId}`;
    }
  });
  revalidatePath("/portal/billing");
}

export async function updateProfile(fd: FormData) {
  const c = await portal();
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  if (name.length < 2 || c.isDemo) return;
  await withDb({ tenantId: c.tenantId, userId: c.user.id }, (tx) => tx`update users set name = ${name} where id = ${c.user.id}`);
  revalidatePath("/portal/settings");
}
