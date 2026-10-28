"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { asStaff, LEAD_STAGES, OPP_STAGES } from "@/lib/ops/data";
import { audit } from "@/lib/audit";
import { INTERNAL_TENANT_ID } from "@/lib/db";
import { createGrant, withClientAccess } from "@/lib/ops/access";
import { evaluateQuote, type QuoteLine } from "@/lib/core/quote";
import { getCatalogue } from "@/lib/content";
import { randomToken } from "@/lib/security";
import { queueMessage } from "@/lib/outbox";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ───────────── Leads ─────────────
export async function updateLead(leadId: string, fd: FormData) {
  const u = await requireStaff();
  const stage = String(fd.get("stage") ?? "");
  const owner = String(fd.get("owner") ?? "");
  const lostReason = String(fd.get("lostReason") ?? "").slice(0, 300) || null;
  if (!LEAD_STAGES.includes(stage as never)) return;
  await asStaff(u, async (tx) => {
    await tx`update leads set stage = ${stage}, owner_id = ${owner || null}, lost_reason = ${stage === "lost" ? lostReason : null}, updated_at = now() where id = ${leadId}`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "lead.updated", entity: "lead", entityId: leadId, meta: { stage } });
  });
  revalidatePath(`/ops/leads/${leadId}`);
}

export async function addLeadNote(leadId: string, fd: FormData) {
  const u = await requireStaff();
  const body = String(fd.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return;
  await asStaff(u, (tx) => tx`insert into lead_notes (tenant_id, lead_id, author_label, body) values (app_tenant(), ${leadId}, ${u.name}, ${body})`);
  revalidatePath(`/ops/leads/${leadId}`);
}

export async function createOpportunity(leadId: string, fd: FormData) {
  const u = await requireStaff();
  const name = String(fd.get("name") ?? "").trim().slice(0, 160) || "New opportunity";
  const id = await asStaff(u, async (tx) => {
    const [o] = await tx<{ id: string }[]>`insert into opportunities (tenant_id, lead_id, name, owner_id) values (app_tenant(), ${leadId}, ${name}, ${u.id}) returning id`;
    await tx`update leads set stage = case when stage in ('new','contacted','qualified') then 'discovery' else stage end, updated_at = now() where id = ${leadId}`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "opportunity.created", entity: "opportunity", entityId: o.id });
    return o.id;
  });
  redirect(`/ops/opportunities/${id}`);
}

// ───────────── Opportunities & diagnostic ─────────────
export async function moveOpportunity(id: string, stage: string) {
  const u = await requireStaff();
  if (!OPP_STAGES.some((s) => s.key === stage)) return;
  await asStaff(u, async (tx) => {
    await tx`update opportunities set stage = ${stage}, updated_at = now() where id = ${id}`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "opportunity.stage", entity: "opportunity", entityId: id, meta: { stage } });
  });
  revalidatePath("/ops/pipeline");
  revalidatePath(`/ops/opportunities/${id}`);
}

const diagSchema = z.object({
  name: z.string().trim().min(2).max(160),
  value: z.coerce.number().min(0),
  closeDate: z.string().optional(),
  ownerMetric: z.string().max(300).optional().default(""),
  baselineValue: z.string().max(100).optional().default(""),
  baselineNote: z.string().max(1000).optional().default(""),
  monthlyVolume: z.coerce.number().min(0).optional().default(0),
  minutesPerTask: z.coerce.number().min(0).optional().default(0),
  errorRatePct: z.coerce.number().min(0).max(100).optional().default(0),
  dataReadiness: z.coerce.number().min(0).max(5).optional().default(3),
  value90: z.coerce.number().min(0).optional().default(0),
  risks: z.string().max(2000).optional().default(""),
  notes: z.string().max(4000).optional().default(""),
});

export async function saveDiagnostic(id: string, fd: FormData) {
  const u = await requireStaff();
  const d = diagSchema.parse(Object.fromEntries(fd));
  await asStaff(u, async (tx) => {
    await tx`update opportunities set name = ${d.name}, value = ${d.value}, close_date = ${d.closeDate || null}, notes = ${d.notes || null},
      diagnostic = ${tx.json({ ownerMetric: d.ownerMetric, baselineValue: d.baselineValue, baselineNote: d.baselineNote, monthlyVolume: d.monthlyVolume, minutesPerTask: d.minutesPerTask, errorRatePct: d.errorRatePct, dataReadiness: d.dataReadiness, value90: d.value90, risks: d.risks, capturedBy: u.name, capturedAt: new Date().toISOString() })},
      updated_at = now() where id = ${id}`;
  });
  revalidatePath(`/ops/opportunities/${id}`);
}

// ───────────── Quotes ─────────────
export async function createQuote(opportunityId: string) {
  const u = await requireStaff();
  const cat = await getCatalogue();
  const id = await asStaff(u, async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from quotes`;
    const number = `Q-${new Date().getFullYear()}-${String(n + 1).padStart(4, "0")}`;
    const lp = (k: string) => cat.pricePoints.find((p) => p.key === k)?.amount ?? 0;
    const lines: QuoteLine[] = [
      { kind: "setup", description: "Elans Launch setup (one solution)", amount: lp("launch.setup"), qty: 1, cost: Math.round(lp("launch.setup") * 0.3) },
      { kind: "monthly", description: "Run retainer: monitoring, support, reporting", amount: lp("launch.monthly"), qty: 1, cost: Math.round(lp("launch.monthly") * 0.3) },
    ];
    const [q] = await tx<{ id: string }[]>`insert into quotes (tenant_id, opportunity_id, number, lines, term_months) values (app_tenant(), ${opportunityId}, ${number}, ${tx.json(lines as never)}, ${cat.settings.minTermMonths}) returning id`;
    await tx`update opportunities set stage = 'proposal', updated_at = now() where id = ${opportunityId} and stage in ('discovery','diagnostic','design')`;
    return q.id;
  });
  redirect(`/ops/quotes/${id}`);
}

const lineSchema = z.object({ kind: z.enum(["setup", "monthly", "usage", "one_off"]), description: z.string().max(200), amount: z.number().min(0), qty: z.number().min(0), cost: z.number().min(0), solution: z.string().optional() });
const quoteSchema = z.object({ lines: z.array(lineSchema).max(30), termMonths: z.number().int().min(1).max(60), discountPct: z.number().min(0).max(50), splitSetup: z.boolean() });

export async function saveQuote(id: string, input: unknown): Promise<{ ok: boolean; message: string }> {
  const u = await requireStaff();
  const p = quoteSchema.safeParse(input);
  if (!p.success) return { ok: false, message: "Invalid quote data." };
  const cat = await getCatalogue();
  return asStaff(u, async (tx) => {
    const [q] = await tx<{ status: string; opportunity_id: string }[]>`select status, opportunity_id from quotes where id = ${id}`;
    if (!q || q.status !== "draft") return { ok: false, message: "Only draft quotes can be edited." };
    const [o] = await tx<{ diagnostic: { value90?: number } }[]>`select diagnostic from opportunities where id = ${q.opportunity_id}`;
    const ev = evaluateQuote({ ...p.data, projected90DayValue: Number(o?.diagnostic?.value90 ?? 0), marginFloor: cat.settings.marginFloor, minTermMonths: cat.settings.minTermMonths });
    await tx`update quotes set lines = ${tx.json(p.data.lines as never)}, term_months = ${p.data.termMonths}, split_setup = ${p.data.splitSetup}, totals = ${tx.json({ ...ev.totals, discountPct: p.data.discountPct } as never)}, checks = ${tx.json(ev.checks as never)} where id = ${id}`;
    await tx`update opportunities set value = ${ev.totals.contractValue}, updated_at = now() where id = ${q.opportunity_id}`;
    return { ok: true, message: "Saved." };
  });
}

export async function sendQuote(id: string, fd: FormData) {
  const u = await requireStaff();
  const email = String(fd.get("email") ?? "").trim();
  const cat = await getCatalogue();
  await asStaff(u, async (tx) => {
    const [q] = await tx<{ status: string; lines: QuoteLine[]; term_months: number; split_setup: boolean; totals: { discountPct?: number }; opportunity_id: string; number: string }[]>`select * from quotes where id = ${id}`;
    if (!q || q.status !== "draft") return;
    const [o] = await tx<{ diagnostic: { value90?: number } }[]>`select diagnostic from opportunities where id = ${q.opportunity_id}`;
    const ev = evaluateQuote({ lines: q.lines, termMonths: q.term_months, discountPct: q.totals?.discountPct ?? 0, splitSetup: q.split_setup, projected90DayValue: Number(o?.diagnostic?.value90 ?? 0), marginFloor: cat.settings.marginFloor, minTermMonths: cat.settings.minTermMonths });
    if (!ev.canSend) throw new Error("This quote breaks a commercial rule (see checks) and cannot be sent.");
    const token = randomToken(18);
    await tx`update quotes set status = 'sent', sent_at = now(), public_token = ${token} where id = ${id}`;
    if (email) await queueMessage(tx, { channel: "email", to: email, subject: `Your Elans proposal ${q.number}`, body: `Your proposal is ready to review and accept:\n${siteUrl()}/quote/${token}` });
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "quote.sent", entity: "quote", entityId: id });
  });
  revalidatePath(`/ops/quotes/${id}`);
}

// ───────────── Live chat inbox ─────────────
export async function replyToConversation(conversationId: string, fd: FormData) {
  const u = await requireStaff();
  const body = String(fd.get("body") ?? "").trim().slice(0, 2000);
  if (!body) return;
  await asStaff(u, async (tx) => {
    await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (app_tenant(), ${conversationId}, 'out', 'human', ${body}, ${tx.json({ staff: u.name })})`;
    await tx`update conversations set status = 'handed_off', assigned_to = ${u.id}, updated_at = now() where id = ${conversationId}`;
    await tx`update handoffs set accepted_by = ${u.id}, accepted_at = coalesce(accepted_at, now()) where conversation_id = ${conversationId}`;
  });
  revalidatePath(`/ops/inbox/${conversationId}`);
}

export async function closeConversation(conversationId: string, resolution: "resolved" | "abandoned") {
  const u = await requireStaff();
  await asStaff(u, (tx) => tx`update conversations set status = 'closed', resolution = ${resolution}, updated_at = now() where id = ${conversationId}`);
  revalidatePath("/ops/inbox");
  redirect("/ops/inbox");
}

export async function returnToAgent(conversationId: string) {
  const u = await requireStaff();
  await asStaff(u, (tx) => tx`update conversations set status = 'open', updated_at = now() where id = ${conversationId}`);
  revalidatePath(`/ops/inbox/${conversationId}`);
}

// ───────────── Bookings ─────────────
export async function setBookingStatus(id: string, status: "completed" | "no_show" | "cancelled" | "confirmed") {
  const u = await requireStaff();
  await asStaff(u, async (tx) => {
    await tx`update bookings set status = ${status} where id = ${id}`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: `booking.${status}`, entity: "booking", entityId: id });
  });
  revalidatePath("/ops/bookings");
}

// ───────────── Assessments ─────────────
export async function reviewAssessment(id: string, fd: FormData) {
  const u = await requireStaff();
  const notes = String(fd.get("notes") ?? "").slice(0, 4000);
  await asStaff(u, (tx) => tx`update assessments set state = 'reviewed', reviewed_by = ${u.id}, review_notes = ${notes || null} where id = ${id}`);
  revalidatePath(`/ops/assessments/${id}`);
}

// ───────────── Client access ─────────────
export async function requestAccess(tenantId: string, fd: FormData) {
  const u = await requireStaff();
  const reason = String(fd.get("reason") ?? "").trim();
  const next = String(fd.get("next") ?? `/ops/clients/${tenantId}`);
  if (reason.length < 8) throw new Error("Please give a reason of at least 8 characters.");
  await createGrant(u, tenantId, reason);
  redirect(next.startsWith("/ops/") ? next : `/ops/clients/${tenantId}`);
}

export async function decideReview(tenantId: string, itemId: string, fd: FormData) {
  const u = await requireStaff();
  const decision = String(fd.get("decision") ?? "");
  const correction = String(fd.get("correction") ?? "");
  const { applyReviewDecision } = await import("@/lib/runtime/review");
  await withClientAccess(u, tenantId, "write:review.decided", (tx) => applyReviewDecision(tx, itemId, { decision: decision as "accept" | "correct" | "reject", correction, by: `Elans: ${u.name}` }));
  revalidatePath(`/ops/clients/${tenantId}`);
}

export async function replyTicket(tenantId: string, ticketId: string, fd: FormData) {
  const u = await requireStaff();
  const body = String(fd.get("body") ?? "").trim().slice(0, 4000);
  const status = String(fd.get("status") ?? "pending");
  await withClientAccess(u, tenantId, "write:ticket.replied", async (tx) => {
    if (body) await tx`insert into ticket_messages (tenant_id, ticket_id, author_label, is_staff, body) values (${tenantId}, ${ticketId}, ${`Elans · ${u.name}`}, true, ${body})`;
    await tx`update tickets set status = ${status}, updated_at = now() where id = ${ticketId}`;
  });
  revalidatePath(`/ops/clients/${tenantId}`);
}

export async function resolveIncident(tenantId: string, incidentId: string) {
  const u = await requireStaff();
  await withClientAccess(u, tenantId, "write:incident.resolved", (tx) => tx`update incidents set status = 'resolved', resolved_at = now() where id = ${incidentId}`);
  revalidatePath(`/ops/clients/${tenantId}`);
  revalidatePath("/ops/operations");
}
