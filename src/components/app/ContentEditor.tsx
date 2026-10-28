"use client";

import { useActionState, useState } from "react";
import { saveContentItem } from "@/app/ops/cms-actions";

const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm";

export function ContentEditor({ type, slug, data, publishState, canEdit }: { type: string; slug: string; data: Record<string, unknown>; publishState: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveContentItem.bind(null, type, slug), null as null | { ok: boolean; message: string });
  const [json, setJson] = useState(() => JSON.stringify(data, null, 2));
  let jsonError: string | null = null;
  try {
    JSON.parse(json);
  } catch (e) {
    jsonError = (e as Error).message;
  }
  const has = (k: string) => k in data;
  return (
    <form action={action} className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {has("name") && <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">Name</span><input name="f_name" defaultValue={String(data.name)} className={field} disabled={!canEdit} /></label>}
        {has("title") && <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">Title</span><input name="f_title" defaultValue={String(data.title)} className={field} disabled={!canEdit} /></label>}
        {has("summary") && <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">Summary</span><textarea name="f_summary" defaultValue={String(data.summary)} className={`${field} h-20 py-2`} disabled={!canEdit} /></label>}
        {has("status") && (
          <label className="text-sm"><span className="mb-1 block text-muted">Status</span>
            <select name="f_status" defaultValue={String(data.status)} className={field} disabled={!canEdit}>
              {(type === "integration" ? ["supported", "planned", "custom_assessment"] : ["live", "pilot", "planned", "custom"]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm"><span className="mb-1 block text-muted">Publishing</span>
          <select name="publish_state" defaultValue={publishState} className={field} disabled={!canEdit}><option value="published">Published</option><option value="draft">Draft (hidden from site)</option></select>
        </label>
      </div>
      <div>
        <label htmlFor="json" className="mb-1 flex items-center justify-between text-sm text-muted"><span>All fields (JSON)</span>{jsonError ? <span className="text-danger">Invalid JSON: {jsonError}</span> : <span className="text-success">Valid JSON</span>}</label>
        <textarea id="json" name="json" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} disabled={!canEdit} className="h-[32rem] w-full rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed" />
        <p className="mt-1 text-xs text-muted">Fields above override the JSON. Flow steps use kinds: input, manual, wait, ai, rule, approval, action, outcome, risk. Statistics must come from a verified source.</p>
      </div>
      {state && <p role="status" className={`rounded-lg p-3 text-sm ${state.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{state.message}</p>}
      {canEdit ? <button disabled={pending || Boolean(jsonError)} className="rounded-lg bg-brown px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button> : <p className="text-sm text-muted">Your role can view but not edit content.</p>}
    </form>
  );
}
