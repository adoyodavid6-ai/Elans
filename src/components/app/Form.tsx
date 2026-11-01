"use client";

import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Console form building blocks: consistent labels, hints and a submit button that shows progress. */
export const inputClass = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brown focus:outline-none";

/** Label and hint are linked to the control by id (not by wrapping), so screen readers announce only the label. */
export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const auto = useId();
  const el = isValidElement(children) ? (children as ReactElement<{ id?: string; "aria-describedby"?: string }>) : null;
  const id = el?.props.id ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={`text-sm ${className}`}>
      <label htmlFor={id} className="mb-1 block font-medium text-heading">{label}</label>
      {el ? cloneElement(el, { id, "aria-describedby": hintId }) : children}
      {hint && <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select({ children, ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} px-2 ${props.className ?? ""}`}>{children}</select>;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} h-auto min-h-24 py-2 ${props.className ?? ""}`} />;
}

const TONES = {
  primary: "bg-brown text-white hover:bg-brown-hover",
  secondary: "bg-surface text-heading ring-1 ring-line hover:bg-surface-2",
  success: "bg-success text-white hover:opacity-90",
  danger: "bg-danger text-white hover:opacity-90",
};

export function SubmitButton({ children, pendingText = "Saving…", tone = "primary", className = "", ...rest }: { children: ReactNode; pendingText?: string; tone?: keyof typeof TONES } & ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} disabled={pending || rest.disabled} aria-busy={pending} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${TONES[tone]} ${className}`}>
      {pending ? pendingText : children}
    </button>
  );
}
