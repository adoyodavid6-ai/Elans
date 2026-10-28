"use server";

import { z } from "zod";
import { answersSchema, contactSchema, STEP_FIELDS } from "@/lib/core/assessment";
import { internal } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security";
import { captureLead } from "@/lib/leads";
import { getCatalogue } from "@/lib/content";
import { buildReport } from "@/lib/engines/assessment";
import { aiAvailable } from "@/lib/ai";
import { queueMessage } from "@/lib/outbox";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { rateLimit, verifyTurnstile } from "@/lib/security";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export type SaveResult = { ok: true; id: string; token?: string } | { ok: false; message: string };

/** Saves progress after each step. Returns a resume token the first time. */
export async function saveAssessmentProgress(input: { id?: string; token?: string; step: number; answers: Record<string, unknown> }): Promise<SaveResult> {
  const ip = await clientIp();
  if (!rateLimit(`assess-save:${ip}`, 60, 10 * 60_000).ok) return { ok: false, message: "Too many requests." };
  // Store only known fields, capped, so arbitrary payloads can't be persisted.
  const allowed = new Set(Object.values(STEP_FIELDS).flat());
  const clean = Object.fromEntries(Object.entries(input.answers).filter(([k]) => allowed.has(k as never)));
  const json = JSON.stringify(clean);
  if (json.length > 20_000) return { ok: false, message: "Answers too long." };
  try {
    return await internal(async (tx) => {
      if (input.id && input.token) {
        const r = await tx`update assessments set answers = ${tx.json(clean as never)}, current_step = ${input.step}, industry = ${String(clean.industry ?? "") || null}, updated_at = now()
          where id = ${input.id} and resume_token_hash = ${sha256(input.token)} and state = 'draft' returning id`;
        if (r.length) return { ok: true as const, id: input.id };
      }
      const token = randomToken(24);
      const [row] = await tx<{ id: string }[]>`insert into assessments (tenant_id, resume_token_hash, answers, current_step, industry)
        values (app_tenant(), ${sha256(token)}, ${tx.json(clean as never)}, ${input.step}, ${String(clean.industry ?? "") || null}) returning id`;
      return { ok: true as const, id: row.id, token };
    });
  } catch {
    return { ok: false, message: "Progress could not be saved right now; you can still continue." };
  }
}

export async function loadAssessmentByToken(token: string) {
  try {
    return await internal(async (tx) => {
      const [row] = await tx<{ id: string; answers: Record<string, unknown>; current_step: number; state: string }[]>`
        select id, answers, current_step, state from assessments where resume_token_hash = ${sha256(token)}`;
      return row ?? null;
    });
  } catch {
    return null;
  }
}

export type SubmitResult = { ok: true; reportUrl: string } | { ok: false; message: string; errors?: Record<string, string> };

export async function submitAssessment(input: { id?: string; token?: string; answers: unknown; contact: unknown; turnstile?: string; honeypot?: string }): Promise<SubmitResult> {
  if (input.honeypot) return { ok: false, message: "Submission rejected." };
  const ip = await clientIp();
  if (!rateLimit(`assess-submit:${ip}`, 5, 60 * 60_000).ok) return { ok: false, message: "You have submitted several assessments recently. Please try again later." };
  if (!(await verifyTurnstile(input.turnstile, ip))) return { ok: false, message: "We could not verify that you are human." };

  const a = answersSchema.safeParse(input.answers);
  if (!a.success) return { ok: false, message: "Some answers are missing or invalid. Please go back and check each step." };
  const c = contactSchema.safeParse(input.contact);
  if (!c.success) {
    const errors: Record<string, string> = {};
    for (const i of (c.error as z.ZodError).issues) errors[String(i.path[0])] = i.message;
    return { ok: false, message: "Please check your contact details.", errors };
  }
  const answers = a.data;
  const contact = c.data;
  const cat = await getCatalogue();
  const report = await buildReport(cat, answers, contact.organisation, { useAi: aiAvailable() });
  const publicToken = randomToken(18);

  try {
    await internal(async (tx) => {
      const { leadId } = await captureLead(
        { name: contact.name, email: contact.email, phone: contact.phone, organisation: contact.organisation, role: contact.role, source: "assessment", sourceDetail: report.opportunities[0]?.name, industry: answers.industry, message: answers.outcome, consentContact: true, consentMarketing: contact.consentMarketing, consentPurpose: "report_delivery" },
        tx,
      );
      let assessmentId = input.id;
      if (assessmentId && input.token) {
        const r = await tx`update assessments set answers = ${tx.json(answers as never)}, state = 'submitted', submitted_at = now(), lead_id = ${leadId}, current_step = 10, industry = ${answers.industry}
          where id = ${assessmentId} and resume_token_hash = ${sha256(input.token)} returning id`;
        if (!r.length) assessmentId = undefined;
      }
      if (!assessmentId) {
        const [row] = await tx<{ id: string }[]>`insert into assessments (tenant_id, resume_token_hash, answers, state, submitted_at, lead_id, current_step, industry)
          values (app_tenant(), ${sha256(randomToken())}, ${tx.json(answers as never)}, 'submitted', now(), ${leadId}, 10, ${answers.industry}) returning id`;
        assessmentId = row.id;
      }
      for (const o of report.opportunities) {
        await tx`insert into opportunity_scores (tenant_id, assessment_id, solution_slug, score, criteria, flag, weight_version_id, rationale)
          values (app_tenant(), ${assessmentId}, ${o.slug}, ${o.score}, ${tx.json(o.topCriteria as never)}, ${o.flag}, ${report.weightVersion}, ${o.rationale})`;
      }
      await tx`insert into reports (tenant_id, assessment_id, public_token, sections, generator) values (app_tenant(), ${assessmentId}, ${publicToken}, ${tx.json(report as never)}, ${report.generator})`;
      await queueMessage(tx, {
        channel: "email",
        to: contact.email,
        subject: "Your Elans AI Opportunity report",
        body: `Hello ${contact.name},\n\nYour preliminary report for ${contact.organisation} is ready:\n${siteUrl()}/assessment/report/${publicToken}\n\nTop opportunity: ${report.opportunities[0]?.name ?? "custom assessment"}.\n\nThe Elans team`,
        meta: { leadId },
      });
      await audit(tx, { tenantId: (await tx`select app_tenant() as t`)[0].t, actorLabel: "public", action: "assessment.submitted", entity: "assessment", entityId: assessmentId, meta: { generator: report.generator } });
    });
  } catch (e) {
    console.error(e);
    return { ok: false, message: "We could not save your report right now. Please try again in a few minutes." };
  }
  return { ok: true, reportUrl: `/assessment/report/${publicToken}` };
}
