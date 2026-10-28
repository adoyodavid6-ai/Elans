"use client";

import { useActionState } from "react";
import { submitPartner } from "@/app/actions/partner";
import { ConsentFields, Field, FormMessage, Honeypot, Input, Select, SubmitButton, Textarea, type FormState } from "./fields";
import { Turnstile } from "./Turnstile";

export function PartnerForm() {
  const [state, action] = useActionState<FormState, FormData>(submitPartner, null);
  if (state?.ok) return <div className="mt-6"><FormMessage state={state} /></div>;
  const e = state?.errors ?? {};
  return (
    <form action={action} className="relative mt-6 space-y-5" noValidate>
      <Honeypot />
      <Field label="Your name" name="name" required error={e.name}><Input name="name" autoComplete="name" error={e.name} /></Field>
      <Field label="Work email" name="email" required error={e.email}><Input name="email" type="email" autoComplete="email" error={e.email} /></Field>
      <Field label="Firm or agency" name="organisation" required error={e.organisation}><Input name="organisation" autoComplete="organization" error={e.organisation} /></Field>
      <Field label="Programme" name="programme" required>
        <Select name="programme" defaultValue="referral">
          <option value="referral">Referral</option>
          <option value="white_label">White-label</option>
        </Select>
      </Field>
      <Field label="Roughly how many clients do you serve?" name="clients"><Input name="clients" inputMode="numeric" /></Field>
      <Field label="Anything we should know?" name="message"><Textarea name="message" /></Field>
      <ConsentFields errors={e} purpose="contact you about the partner programme" />
      <Turnstile />
      <FormMessage state={state} />
      <SubmitButton>Register interest</SubmitButton>
    </form>
  );
}
