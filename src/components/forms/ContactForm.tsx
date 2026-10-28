"use client";

import { useActionState } from "react";
import { submitContact } from "@/app/actions/contact";
import { ConsentFields, Field, FormMessage, Honeypot, Input, Select, SubmitButton, Textarea, type FormState } from "./fields";
import { Turnstile } from "./Turnstile";

const TOPICS = [
  ["general", "General enquiry"],
  ["quote", "Request a quotation"],
  ["grow", "Growth & marketing"],
  ["template", "Template implementation"],
  ["partnership", "Partnership / white-label"],
  ["support", "Existing client support"],
  ["security", "Security disclosure"],
  ["careers", "Careers"],
];

export function ContactForm({ topic = "general", context = "" }: { topic?: string; context?: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitContact, null);
  if (state?.ok) return <FormMessage state={state} />;
  const e = state?.errors ?? {};
  return (
    <form action={action} className="relative space-y-5" noValidate>
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" required error={e.name}>
          <Input name="name" autoComplete="name" required error={e.name} />
        </Field>
        <Field label="Work email" name="email" required error={e.email}>
          <Input name="email" type="email" autoComplete="email" required error={e.email} />
        </Field>
        <Field label="Phone or WhatsApp" name="phone" error={e.phone} hint="Include the country code, e.g. +254…">
          <Input name="phone" type="tel" autoComplete="tel" error={e.phone} />
        </Field>
        <Field label="Organisation" name="organisation" error={e.organisation}>
          <Input name="organisation" autoComplete="organization" error={e.organisation} />
        </Field>
      </div>
      <Field label="Topic" name="topic" required>
        <Select name="topic" defaultValue={topic}>
          {TOPICS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <input type="hidden" name="context" value={context} />
      {context && <p className="rounded-xl bg-sand/60 px-3 py-2 text-sm">About: <span className="font-semibold">{context}</span></p>}
      <Field label="How can we help?" name="message" required error={e.message} hint="A sentence or two about your business and what you'd like to change is plenty.">
        <Textarea name="message" required error={e.message} />
      </Field>
      <ConsentFields errors={e} />
      <Turnstile />
      <FormMessage state={state} />
      <SubmitButton>Send message</SubmitButton>
    </form>
  );
}
