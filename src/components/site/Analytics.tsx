"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Privacy-respecting analytics (Plausible: cookieless, no personal data), loaded only after the visitor
 * consents, as the cookie policy promises. Nothing renders unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set.
 */
const KEY = "elans_analytics";

export function Analytics({ domain, src = "https://plausible.io/js/script.js" }: { domain?: string; src?: string }) {
  const [choice, setChoice] = useState<"yes" | "no" | null | undefined>(undefined);
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      setChoice(v === "yes" || v === "no" ? v : null);
    } catch {
      setChoice(null);
    }
  }, []);
  useEffect(() => {
    if (!domain || choice !== "yes" || document.getElementById("plausible")) return;
    const s = document.createElement("script");
    s.id = "plausible";
    s.defer = true;
    s.dataset.domain = domain;
    s.src = src;
    document.head.appendChild(s);
  }, [domain, choice, src]);
  if (!domain || choice !== null) return null;
  const decide = (v: "yes" | "no") => {
    try { localStorage.setItem(KEY, v); } catch {}
    setChoice(v);
  };
  return (
    <div role="region" aria-label="Analytics consent" className="no-print fixed inset-x-3 bottom-20 z-40 mx-auto max-w-xl rounded-2xl border border-line bg-white p-4 text-sm shadow-[var(--shadow-lift)] md:bottom-4">
      <p className="text-text">May we count your visit with privacy-friendly analytics? No cookies, no advertising, no personal data. <Link href="/legal/cookies" className="font-semibold text-copper-ink underline">Cookie policy</Link></p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => decide("yes")} className="rounded-full bg-brown px-4 py-2 font-semibold text-white hover:bg-brown-hover">Allow</button>
        <button type="button" onClick={() => decide("no")} className="rounded-full px-4 py-2 font-semibold text-espresso ring-1 ring-line hover:bg-sand/40">No thanks</button>
      </div>
    </div>
  );
}
