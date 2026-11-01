"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} aria-label="Client link" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the field is selectable */ } }} className="h-9 shrink-0 rounded-lg px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface-2">{copied ? "Copied" : "Copy"}</button>
      <a href={url} target="_blank" rel="noopener" className="inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface-2">Open</a>
    </div>
  );
}
