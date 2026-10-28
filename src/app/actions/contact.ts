"use server";

import { z } from "zod";
import { captureLead } from "@/lib/leads";
import { checkbox, dbErrorState, fieldErrors, guardPublicForm, optStr, str } from "@/lib/forms";
import type { FormState } from "@/components/forms/fields";

const schema = z.object({
  name: str(120, 2),
  email: z.email({ error: "Enter a valid email address." }),
  phone: optStr(30),
  organisation: optStr(160),
  topic: z.enum(["general", "quote", "grow", "template", "partnership", "careers", "security", "support"]).default("general"),
  context: optStr(200),
  message: str(3000, 10),
  consentContact: checkbox.refine((v) => v, "Please agree so we can reply to you."),
  consentMarketing: checkbox,
});

export async function submitContact(_: FormState, fd: FormData): Promise<FormState> {
  const blocked = await guardPublicForm(fd, "contact");
  if (blocked) return blocked;
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    await captureLead({ name: d.name, email: d.email, phone: d.phone, organisation: d.organisation, source: "contact", sourceDetail: [d.topic, d.context].filter(Boolean).join(" · "), message: d.message, consentContact: true, consentMarketing: d.consentMarketing, consentPurpose: "enquiry" });
    return { ok: true, message: "Thank you. We have your message and will reply within one business day." };
  } catch (e) {
    return dbErrorState(e);
  }
}
