"use client";

import { Icon } from "@/components/ui/Icon";

export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-espresso ring-1 ring-line hover:bg-sand/40">
      <Icon name="download" size={16} /> {label}
    </button>
  );
}
