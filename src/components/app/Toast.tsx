"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Shows the server-set flash message once, then clears the cookie. */
export function Toast({ flash }: { flash: { m: string; t: "success" | "error" | "info"; id: number } | null }) {
  const [shown, setShown] = useState(flash);
  useEffect(() => {
    if (!flash) return;
    setShown(flash);
    document.cookie = "elans_flash=; path=/; max-age=0; samesite=lax";
    const t = setTimeout(() => setShown(null), 4500);
    return () => clearTimeout(t);
  }, [flash?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return <div aria-live="polite" className="sr-only" />;
  const tone = shown.t === "error" ? "bg-danger text-white" : shown.t === "info" ? "bg-graphite text-white" : "bg-success text-white";
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 lg:bottom-6 lg:justify-end lg:px-8">
      <div className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-[var(--shadow-lift)] ${tone}`}>
        <Icon name={shown.t === "error" ? "x" : shown.t === "info" ? "info" : "check"} size={18} />
        <span>{shown.m}</span>
        <button type="button" onClick={() => setShown(null)} aria-label="Dismiss" className="ml-1 rounded p-0.5 opacity-80 hover:opacity-100"><Icon name="x" size={14} /></button>
      </div>
    </div>
  );
}
