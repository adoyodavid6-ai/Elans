"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

export type FormState = { ok: boolean; message?: string; errors?: Record<string, string>; data?: Record<string, unknown> } | null;

const inputCls = "block w-full rounded-xl border border-line bg-white px-3.5 text-[0.95rem] text-text placeholder:text-muted/70 focus:border-brown focus:outline-none focus:ring-2 focus:ring-copper/40 aria-[invalid=true]:border-danger";

export function Field({ label, name, hint, error, required, children, className }: { label: ReactNode; name: string; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold text-heading">
        {label} {required && <span className="text-danger" aria-hidden>*</span>}
        {!required && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${name}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="mt-1 flex items-center gap-1 text-xs font-medium text-danger">
          <Icon name="alert" size={13} /> {error}
        </p>
      )}
    </div>
  );
}

export function Input({ name, error, className, ...rest }: { name: string; error?: string } & ComponentProps<"input">) {
  return <input id={name} name={name} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : `${name}-hint`} className={cx(inputCls, "h-12", className)} {...rest} />;
}
export function Textarea({ name, error, className, ...rest }: { name: string; error?: string } & ComponentProps<"textarea">) {
  return <textarea id={name} name={name} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : `${name}-hint`} className={cx(inputCls, "min-h-28 py-3", className)} {...rest} />;
}
export function Select({ name, error, className, children, ...rest }: { name: string; error?: string } & ComponentProps<"select">) {
  return (
    <select id={name} name={name} aria-invalid={Boolean(error)} className={cx(inputCls, "h-12", className)} {...rest}>
      {children}
    </select>
  );
}
export function Checkbox({ name, label, error, required, ...rest }: { name: string; label: ReactNode; error?: string; required?: boolean } & ComponentProps<"input">) {
  return (
    <div>
      <label htmlFor={name} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input id={name} name={name} type="checkbox" required={required} aria-invalid={Boolean(error)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-brown" {...rest} />
        <span>
          {label} {required && <span className="text-danger" aria-hidden>*</span>}
        </span>
      </label>
      {error && <p className="ml-8 mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function SubmitButton({ children, pendingText = "Sending…", className }: { children: ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cx("inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brown px-6 font-semibold text-white hover:bg-brown-hover disabled:opacity-60", className)}>
      {pending ? pendingText : children}
      {!pending && <Icon name="arrow-right" size={18} />}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <div role={state.ok ? "status" : "alert"} className={cx("flex gap-2 rounded-xl p-3 text-sm", state.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>
      <Icon name={state.ok ? "check" : "alert"} size={18} className="mt-0.5 shrink-0" />
      <span>{state.message}</span>
    </div>
  );
}

/** Invisible to people, tempting to bots. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
      <label htmlFor="company_website">Leave this field empty</label>
      <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function ConsentFields({ errors, purpose = "respond to your enquiry" }: { errors?: Record<string, string>; purpose?: string }) {
  return (
    <div className="space-y-3 rounded-2xl bg-surface-2/70 p-4">
      <Checkbox name="consentContact" required error={errors?.consentContact} label={<>I agree that Elans may use these details to {purpose}, as described in the <a href="/legal/privacy" className="underline" target="_blank">privacy notice</a>.</>} />
      <Checkbox name="consentMarketing" label="Send me occasional insights and offers. I can unsubscribe at any time." />
    </div>
  );
}
