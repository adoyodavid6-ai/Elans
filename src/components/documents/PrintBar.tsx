"use client";

import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

/** Toolbar above a printable document. The browser's print dialog offers "Save as PDF". */
export function PrintBar({ filename, back, auto = false }: { filename: string; back?: string; auto?: boolean }) {
  useEffect(() => {
    const prev = document.title;
    document.title = filename;
    if (auto) setTimeout(() => window.print(), 400);
    return () => { document.title = prev; };
  }, [filename, auto]);
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
      {back ? <a href={back} className="text-sm font-semibold text-[#6A012A] hover:underline">← Back</a> : <span />}
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-[#5c5c5c] sm:inline">Choose &quot;Save as PDF&quot; in the print dialog to download.</span>
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#6A012A] px-5 text-sm font-semibold text-white hover:bg-[#540122]"><Icon name="download" size={16} /> Print / download PDF</button>
      </div>
    </div>
  );
}
