"use server";

import { z } from "zod";
import { internal } from "@/lib/db";
import { captureLead } from "@/lib/leads";
import { checkbox, dbErrorState, fieldErrors, guardPublicForm, optStr, str } from "@/lib/forms";
import type { FormState } from "@/components/forms/fields";

const schema = z.object({
  name: str(120, 2),
  email: z.email({ error: "Enter a valid email address." }),
  organisation: str(160, 2),
  programme: z.enum(["referral", "white_label"]),
  clients: optStr(60),
  message: optStr(2000),
  consentContact: checkbox.refine((v) => v, "Please agree so we can contact you."),
  consentMarketing: checkbox,
});

export async function submitPartner(_: FormState, fd: FormData): Promise<FormState> {
  const blocked = await guardPublicForm(fd, "partner");
  if (blocked) return blocked;
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    await internal(async (tx) => {
      await captureLead({ name: d.name, email: d.email, organisation: d.organisation, source: "partner", sourceDetail: `${d.programme} · ${d.clients} clients`, message: d.message, consentContact: true, consentMarketing: d.consentMarketing, consentPurpose: "enquiry" }, tx);
      await tx`insert into partners (tenant_id, name, programme, contact_email) values (app_tenant(), ${d.organisation}, ${d.programme}, ${d.email})`;
    });
    return { ok: true, message: "Thank you. Your interest is registered and we will be in touch within five business days." };
  } catch (e) {
    return dbErrorState(e);
  }
}
