"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Safety net for form actions in the console and portal. Every action sets a one-shot flash cookie that the
 * toast clears once the updated page is on screen. In production builds the router occasionally drops an
 * action's (correct) response and leaves the old page showing; if the flash cookie is still there shortly
 * after a submit, the update was dropped: refresh the page data, and if that is dropped too, reload the page.
 * The action has already been saved, so the reload only brings the result (and its confirmation) on screen.
 */
export function ActionSafetyNet() {
  const router = useRouter();
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    const pending = () => /(?:^|;\s*)elans_flash=/.test(document.cookie);
    const onSubmit = () => {
      if (poll) clearInterval(poll);
      const started = Date.now();
      let seenAt = 0, refreshed = false;
      // Time from when the action's response (and its flash cookie) arrives, not from the click, so slow actions are not reloaded.
      poll = setInterval(() => {
        const now = Date.now();
        if (now - started > 30_000) { clearInterval(poll!); return; }
        if (!pending()) { if (seenAt) clearInterval(poll!); return; }
        if (!seenAt) seenAt = now;
        if (!refreshed && now - seenAt > 1200) { refreshed = true; router.refresh(); }
        if (now - seenAt > 2800) { clearInterval(poll!); window.location.reload(); }
      }, 200);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => { document.removeEventListener("submit", onSubmit, true); if (poll) clearInterval(poll); };
  }, [router]);
  return null;
}
