"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Safety net for form actions in the console and portal. In production builds the Next.js router occasionally
 * drops an action's (correct) response and leaves the old page on screen. Two signals catch it:
 *  1. Actions that confirm with a toast set a one-shot flash cookie that the toast clears once the updated page
 *     is showing. If it is still there shortly after the response arrived, refresh the page data, then reload.
 *  2. Actions that end by redirecting say where in the response (x-action-redirect). If the browser has not
 *     gone there shortly after, go there directly.
 * The action has already been saved in both cases; this only brings the result on screen.
 */
export function ActionSafetyNet() {
  const router = useRouter();
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    const redirects: ReturnType<typeof setTimeout>[] = [];
    const pending = () => /(?:^|;\s*)elans_flash=/.test(document.cookie);

    const onSubmit = () => {
      if (poll) clearInterval(poll);
      const started = Date.now();
      let seenAt = 0, refreshed = false;
      // Timed from when the response (and its flash cookie) arrives, not from the click, so slow actions are not reloaded.
      poll = setInterval(() => {
        const now = Date.now();
        if (now - started > 30_000) { clearInterval(poll!); return; }
        if (!pending()) { if (seenAt) clearInterval(poll!); return; }
        if (!seenAt) seenAt = now;
        if (!refreshed && now - seenAt > 1200) { refreshed = true; router.refresh(); }
        if (now - seenAt > 2800) { clearInterval(poll!); window.location.reload(); }
      }, 200);
    };

    const original = window.fetch;
    const wrapped: typeof window.fetch = async (input, init) => {
      const from = window.location.href;
      const res = await original(input, init);
      try {
        const headers = new Headers(init?.headers);
        const target = headers.has("next-action") ? res.headers.get("x-action-redirect")?.split(";")[0] : null;
        if (target) {
          const want = new URL(target, window.location.href);
          redirects.push(setTimeout(() => {
            // Only if the browser is still exactly where the action was sent from (it neither followed the
            // redirect nor did the person go somewhere else meanwhile).
            if (window.location.href === from && want.href !== from) window.location.assign(want.href);
          }, 2500));
        }
      } catch { /* never interfere with the request itself */ }
      return res;
    };
    window.fetch = wrapped;
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      if (window.fetch === wrapped) window.fetch = original;
      if (poll) clearInterval(poll);
      redirects.forEach(clearTimeout);
    };
  }, [router]);
  return null;
}
