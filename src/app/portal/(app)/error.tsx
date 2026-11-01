"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/system/StatusPage";

/** Friendly error screen with retry; the digest lets support find the server log entry. */
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <StatusPage
      code="Something went wrong"
      title="This page didn't load properly"
      actions={
        <>
          <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-full bg-brown px-5 text-sm font-semibold text-white hover:bg-brown-hover">Try again</button>
          <a href="/portal" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-espresso ring-1 ring-line">Back to the overview</a>
        </>
      }
    >
      <p>Please try again. If it keeps happening, raise a support ticket and quote this reference: <span className="font-mono text-sm">{error.digest ?? "n/a"}</span>.</p>
    </StatusPage>
  );
}
