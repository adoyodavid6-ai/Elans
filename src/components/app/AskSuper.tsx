"use client";

import { useId, useRef } from "react";
import { requestSuper } from "@/app/ops/request-actions";
import { SubmitButton } from "./Form";

/**
 * Shown to admins in place of a super-admin-only action. Opens a small dialog and sends the request to the
 * Super Admin's Requests inbox (and email). A modal dialog is used so it is never clipped by scrolling tables.
 */
export function AskSuper({ kind, title, link, payload = {}, label = "Ask Super Admin", compact = false, className = "" }: { kind: string; title: string; link: string; payload?: Record<string, string>; label?: string; compact?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <span className={`inline-block ${className}`}>
      <button type="button" onClick={() => ref.current?.showModal()} title={`Needs the Super Admin: ${title}`} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold text-copper-ink ring-1 ring-copper/40 hover:bg-wine-50 ${compact ? "h-7 px-2 text-xs" : "h-10 px-3 text-sm"}`}>
        <span aria-hidden="true">↑</span> {label}
      </button>
      <dialog ref={ref} aria-labelledby={`${id}-h`} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-left text-ink shadow-[var(--shadow-lift)] backdrop:bg-black/40">
        <form action={async (fd) => { await requestSuper(fd); ref.current?.close(); }} className="p-5">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="link" value={link} />
          <input type="hidden" name="payload" value={JSON.stringify(payload)} />
          <p id={`${id}-h`} className="font-semibold text-heading">Ask the Super Admin</p>
          <p className="mt-1 text-sm text-muted">This needs Super Admin access. Your request goes to their Requests inbox and email; you&apos;ll see the outcome under My requests.</p>
          <p className="mt-3 rounded-lg bg-surface-2 p-2 text-sm font-medium">{title}</p>
          <label className="mt-3 block text-sm font-medium" htmlFor={`${id}-note`}>Note (optional)</label>
          <textarea id={`${id}-note`} name="note" rows={3} className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm" placeholder="Why it's needed, any details" />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="h-9 rounded-lg px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface-2">Cancel</button>
            <SubmitButton className="h-9 px-4 text-sm" pendingText="Sending…">Send request</SubmitButton>
          </div>
        </form>
      </dialog>
    </span>
  );
}
