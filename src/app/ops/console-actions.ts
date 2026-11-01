"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff, requireSuper } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { withClientAccess } from "@/lib/ops/access";
import { provisionClient } from "@/lib/ops/provision";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { queueMessage } from "@/lib/outbox";
import { randomToken, sha256 } from "@/lib/security";
import { NOTICE_VERSION } from "@/lib/leads";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const text = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max);

// ───────────── Leads ─────────────
const leadSchema = z.object({
  name: z.string().trim().min(2, "Enter the contact's name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200).or(z.literal("")),
  phone: z.string().trim().max(40),
  organisation: z.string().trim().max(160),
  industry: z.string().trim().max(80),
  channel: z.enum(["phone", "walk_in", "referral", "event", "email", "whatsapp", "other"]),
  message: z.string().trim().max(4000),
  nextAction: z.string().trim().max(200),
  nextActionDue: z.string().trim().max(10),
  consentContact: z.boolean(),
});

/** A lead entered by staff (phone call, walk-in, referral, event). Marketing consent can only come from the contact. */
export async function createLead(fd: FormData) {
  const u = await requireStaff();
  const p = leadSchema.safeParse({
    name: text(fd, "name", 120), email: text(fd, "email", 200), phone: text(fd, "phone", 40), organisation: text(fd, "organisation", 160),
    industry: text(fd, "industry", 80), channel: text(fd, "channel", 20) || "other", message: text(fd, "message", 4000),
    nextAction: text(fd, "nextAction", 200), nextActionDue: text(fd, "nextActionDue", 10), consentContact: fd.get("consentContact") === "on",
  });
  if (!p.success) {
    await flash(p.error.issues[0]?.message ?? "Please check the form.", "error");
    redirect("/ops/leads/new");
  }
  if (!p.data.email && !p.data.phone) {
    await flash("Enter an email or a phone number so the lead can be contacted.", "error");
    redirect("/ops/leads/new");
  }
  const d = p.data;
  const id = await asStaff(u, async (tx) => {
    const [existing] = d.email ? await tx<{ id: string }[]>`select id from contacts where lower(email) = lower(${d.email}) and erased_at is null limit 1` : [];
    const contactId = existing?.id ?? (await tx<{ id: string }[]>`insert into contacts (tenant_id, name, email, phone, organisation) values (app_tenant(), ${d.name}, ${d.email || null}, ${d.phone || null}, ${d.organisation || null}) returning id`)[0].id;
    await tx`insert into consents (tenant_id, contact_id, purpose, granted, notice_version, source) values (app_tenant(), ${contactId}, 'contact', ${d.consentContact}, ${NOTICE_VERSION}, ${`staff:${d.channel}`})`;
    const score = 10 + (d.organisation ? 10 : 0) + (d.phone ? 5 : 0) + (d.channel === "referral" ? 15 : 0);
    const [lead] = await tx<{ id: string }[]>`insert into leads (tenant_id, contact_id, source, source_detail, industry, score, message, owner_id, next_action, next_action_due)
      values (app_tenant(), ${contactId}, 'manual', ${d.channel.replace("_", "-")}, ${d.industry || null}, ${score}, ${d.message || null}, ${u.id}, ${d.nextAction || null}, ${d.nextActionDue || null}) returning id`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "lead.created_manually", entity: "lead", entityId: lead.id, meta: { channel: d.channel } });
    return lead.id;
  });
  await flash("Lead added and assigned to you");
  redirect(`/ops/leads/${id}`);
}

export async function setNextAction(leadId: string, fd: FormData) {
  const u = await requireStaff();
  const action = text(fd, "nextAction", 200);
  const due = text(fd, "nextActionDue", 10);
  const done = fd.get("done") === "1";
  await asStaff(u, async (tx) => {
    if (done) {
      const [l] = await tx<{ next_action: string | null }[]>`select next_action from leads where id = ${leadId}`;
      if (l?.next_action) await tx`insert into lead_notes (tenant_id, lead_id, author_label, body) values (app_tenant(), ${leadId}, ${u.name}, ${`Done: ${l.next_action}`})`;
      await tx`update leads set next_action = null, next_action_due = null, updated_at = now() where id = ${leadId}`;
    } else {
      await tx`update leads set next_action = ${action || null}, next_action_due = ${due || null}, updated_at = now() where id = ${leadId}`;
    }
  });
  await flash(done ? "Follow-up marked done (logged in notes)" : action ? "Follow-up scheduled" : "Follow-up cleared");
  revalidatePath(`/ops/leads/${leadId}`);
  revalidatePath("/ops");
}

// ───────────── Clients ─────────────
export async function createClient(fd: FormData) {
  const u = await requireSuper();
  const name = text(fd, "name", 160);
  const adminEmail = text(fd, "adminEmail", 200).toLowerCase();
  const packageKey = ["launch", "growth", "scale", "enterprise"].includes(text(fd, "package")) ? text(fd, "package") : "launch";
  const monthly = Number(text(fd, "monthly")) || 0;
  const solutions = fd.getAll("solutions").map(String).filter(Boolean).slice(0, 10);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    await flash("Enter the client's name and a valid admin email.", "error");
    redirect("/ops/clients/new");
  }
  const { tenantId } = await provisionClient({ name, adminEmail, packageKey, monthly, solutionSlugs: solutions, quoteId: `manual:${u.email}` });
  await asStaff(u, (tx) => audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "client.created", entity: "tenant", entityId: tenantId, meta: { packageKey } }));
  await flash(`${name} created. An invitation was sent to ${adminEmail}.`);
  redirect(`/ops/clients/${tenantId}`);
}

export async function inviteClientMember(tenantId: string, fd: FormData) {
  const u = await requireStaff();
  const email = text(fd, "email", 200).toLowerCase();
  const role = ["owner", "admin", "approver", "member", "viewer"].includes(text(fd, "role")) ? text(fd, "role") : "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await flash("Enter a valid email address.", "error");
    redirect(`/ops/clients/${tenantId}?tab=team`);
  }
  const token = randomToken(24);
  const ok = await withClientAccess(u, tenantId, "write:member.invited_by_elans", async (tx) => {
    await tx`insert into invites (tenant_id, email, role, token_hash, expires_at, created_by) values (${tenantId}, ${email}, ${role}, ${sha256(token)}, now() + interval '14 days', ${`Elans · ${u.name}`})`;
    await queueMessage(tx, { channel: "email", to: email, subject: "You've been invited to an Elans client portal", body: `Accept your invitation (valid for 14 days):\n${siteUrl()}/portal/invite/${token}` });
    return true;
  });
  await flash(ok ? `Invitation sent to ${email}` : "Your access to this client has expired. Request access again.", ok ? "success" : "error");
  revalidatePath(`/ops/clients/${tenantId}`);
}

export async function setAutomationState(tenantId: string, instanceId: string, change: "pause" | "resume" | "kill" | "unkill") {
  // Admins can stop things (pause, kill switch); turning them back on is for the Super Admin.
  const u = change === "resume" || change === "unkill" ? await requireSuper() : await requireStaff();
  const ok = await withClientAccess(u, tenantId, `write:automation.${change}_by_elans`, async (tx) => {
    if (change === "pause") await tx`update engine_instances set status = 'paused' where id = ${instanceId}`;
    if (change === "resume") await tx`update engine_instances set status = 'live' where id = ${instanceId} and status = 'paused'`;
    if (change === "kill" || change === "unkill") await tx`update engine_instances set kill_switch = ${change === "kill"} where id = ${instanceId}`;
    return true;
  });
  await flash(ok ? { pause: "Automation paused", resume: "Automation resumed", kill: "Kill switch on: all actions stopped", unkill: "Kill switch off" }[change] : "Your access to this client has expired. Request access again.", ok ? "success" : "error");
  revalidatePath(`/ops/clients/${tenantId}`);
}

// ───────────── Billing ─────────────
export async function createInvoice(fd: FormData) {
  const u = await requireStaff();
  const tenantId = text(fd, "tenantId", 40);
  const amount = Number(text(fd, "amount"));
  const description = text(fd, "description", 300);
  const due = text(fd, "dueDate", 10);
  const back = text(fd, "back", 200).startsWith("/ops/") ? text(fd, "back", 200) : "/ops/billing";
  if (!/^[0-9a-f-]{36}$/.test(tenantId) || !(amount > 0) || description.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    await flash("Choose a client and enter a description, a positive amount and a due date.", "error");
    redirect(back);
  }
  try {
    await asStaff(u, (tx) => tx`select ops_create_invoice(${tenantId}, ${amount}, ${description}, ${due}::date, ${`Elans · ${u.name}`})`);
    await flash("Invoice issued. The client sees it in Usage & Billing and can pay by M-Pesa.");
  } catch (e) {
    await flash(`Invoice not issued: ${(e as Error).message}`, "error");
  }
  revalidatePath("/ops/billing");
  redirect(back);
}

export async function setInvoiceStatus(invoiceId: string, status: "paid" | "void" | "issued") {
  const u = await requireSuper();
  try {
    await asStaff(u, (tx) => tx`select ops_set_invoice_status(${invoiceId}, ${status}, ${`Elans · ${u.name}`})`);
    await flash({ paid: "Invoice marked as paid", void: "Invoice voided", issued: "Invoice reopened" }[status]);
  } catch (e) {
    await flash(`Not updated: ${(e as Error).message}`, "error");
  }
  revalidatePath("/ops/billing");
}

// ───────────── Partners ─────────────
const PARTNER_STATUSES = ["applied", "in_review", "approved", "active", "paused", "rejected"] as const;

export async function updatePartner(partnerId: string, fd: FormData) {
  const u = await requireStaff();
  const status = text(fd, "status");
  const notes = text(fd, "notes", 4000);
  if (!PARTNER_STATUSES.includes(status as never)) return;
  await asStaff(u, async (tx) => {
    await tx`update partners set status = ${status}, notes = ${notes || null}, updated_at = now() where id = ${partnerId}`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "partner.updated", entity: "partner", entityId: partnerId, meta: { status } });
  });
  await flash("Partner updated");
  revalidatePath("/ops/partners");
}

/** Creates the partner's own workspace (a partner tenant) and invites their contact as owner. */
export async function createPartnerWorkspace(partnerId: string) {
  const u = await requireSuper();
  const p = await asStaff(u, async (tx) => (await tx<{ name: string; contact_email: string | null; partner_tenant_id: string | null }[]>`select name, contact_email, partner_tenant_id from partners where id = ${partnerId}`)[0]);
  if (!p || p.partner_tenant_id || !p.contact_email) {
    await flash(!p?.contact_email ? "This partner has no contact email." : "A workspace already exists.", "error");
    revalidatePath("/ops/partners");
    return;
  }
  const tenantId = await withDb({ system: true }, async (tx) => (await tx<{ id: string }[]>`insert into tenants (name, kind) values (${p.name}, 'partner') returning id`)[0].id);
  const token = randomToken(24);
  await withDb({ tenantId }, async (tx) => {
    await tx`insert into invites (tenant_id, email, role, token_hash, expires_at, created_by) values (${tenantId}, ${p.contact_email}, 'owner', ${sha256(token)}, now() + interval '14 days', ${`Elans · ${u.name}`})`;
    await queueMessage(tx, { channel: "email", to: p.contact_email!, subject: "Your Elans partner workspace is ready", body: `Activate your partner workspace (link valid for 14 days):\n${siteUrl()}/portal/invite/${token}` });
    await audit(tx, { tenantId, actorLabel: `Elans · ${u.name}`, action: "tenant.provisioned", meta: { partnerId } });
  });
  await asStaff(u, (tx) => tx`update partners set partner_tenant_id = ${tenantId}, status = case when status in ('applied','in_review','approved') then 'active' else status end, updated_at = now() where id = ${partnerId}`);
  await flash(`Partner workspace created; invitation sent to ${p.contact_email}`);
  revalidatePath("/ops/partners");
}
