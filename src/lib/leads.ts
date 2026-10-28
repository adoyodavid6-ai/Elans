import "server-only";
import { internal, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { queueMessage } from "@/lib/outbox";

export const NOTICE_VERSION = "privacy-2026-10-28";

export interface LeadInput {
  name: string;
  email: string;
  phone?: string;
  organisation?: string;
  role?: string;
  source: "assessment" | "contact" | "roi" | "ai_visibility" | "chat" | "booking" | "partner";
  sourceDetail?: string;
  industry?: string;
  message?: string;
  utm?: Record<string, string>;
  consentContact: boolean;
  consentMarketing: boolean;
  consentPurpose: string; // e.g. report_delivery | enquiry | booking
}

/** Upserts a contact by email, records consents and creates a lead in the Elans internal tenant. */
export async function captureLead(input: LeadInput, txIn?: Tx) {
  const run = async (tx: Tx) => {
    const email = input.email.trim().toLowerCase();
    const [existing] = await tx<{ id: string }[]>`select id from contacts where lower(email) = ${email} and erased_at is null limit 1`;
    const contactId =
      existing?.id ??
      (
        await tx<{ id: string }[]>`insert into contacts (tenant_id, name, email, phone, organisation, role_title)
          values (app_tenant(), ${input.name}, ${email}, ${input.phone || null}, ${input.organisation || null}, ${input.role || null}) returning id`
      )[0].id;
    if (existing) {
      await tx`update contacts set name = ${input.name}, phone = coalesce(${input.phone || null}, phone), organisation = coalesce(${input.organisation || null}, organisation) where id = ${contactId}`;
    }
    await tx`insert into consents (tenant_id, contact_id, purpose, granted, notice_version, source)
      values (app_tenant(), ${contactId}, ${input.consentPurpose}, ${input.consentContact}, ${NOTICE_VERSION}, ${input.source})`;
    await tx`insert into consents (tenant_id, contact_id, purpose, granted, notice_version, source)
      values (app_tenant(), ${contactId}, 'marketing', ${input.consentMarketing}, ${NOTICE_VERSION}, ${input.source})`;
    const score = scoreLead(input);
    const [lead] = await tx<{ id: string }[]>`insert into leads (tenant_id, contact_id, source, source_detail, utm, industry, score, message)
      values (app_tenant(), ${contactId}, ${input.source}, ${input.sourceDetail ?? null}, ${tx.json(input.utm ?? {})}, ${input.industry ?? null}, ${score}, ${input.message ?? null}) returning id`;
    await audit(tx, { tenantId: (await tx`select app_tenant() as t`)[0].t, actorLabel: "public", action: "lead.created", entity: "lead", entityId: lead.id, meta: { source: input.source } });
    await queueMessage(tx, { channel: "email", to: "team@elans", subject: `New ${input.source} lead: ${input.organisation || input.name}`, body: `${input.name} <${email}>\n${input.organisation ?? ""}\n${input.sourceDetail ?? ""}\n\n${input.message ?? ""}`, meta: { leadId: lead.id } });
    return { leadId: lead.id, contactId };
  };
  return txIn ? run(txIn) : internal(run);
}

function scoreLead(i: LeadInput) {
  let s = 10;
  if (i.organisation) s += 10;
  if (i.phone) s += 5;
  if (i.source === "booking") s += 30;
  if (i.source === "assessment") s += 20;
  if (i.sourceDetail?.includes("quote")) s += 25;
  if (i.message && i.message.length > 80) s += 10;
  return Math.min(100, s);
}
