"use client";

import { useActionState } from "react";
import { confirmEnrolment, login, verifyMfa } from "@/app/actions/auth";
import { Field, FormMessage, Input, SubmitButton, type FormState } from "@/components/forms/fields";

export function LoginForm({ area }: { area: "ops" | "portal" }) {
  const [state, action] = useActionState<FormState, FormData>(login.bind(null, area), null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" name="email" required>
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password" name="password" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Signing in…" className="w-full">Sign in</SubmitButton>
    </form>
  );
}

export function CodeForm({ area, mode }: { area: "ops" | "portal"; mode: "verify" | "enrol" }) {
  const [state, action] = useActionState<FormState, FormData>((mode === "verify" ? verifyMfa : confirmEnrolment).bind(null, area), null);
  return (
    <form action={action} className="space-y-4">
      <Field label="6-digit code from your authenticator app" name="code" required>
        <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required className="text-center font-mono text-xl tracking-[0.4em]" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Checking…" className="w-full">{mode === "verify" ? "Verify" : "Turn on two-step verification"}</SubmitButton>
    </form>
  );
}
