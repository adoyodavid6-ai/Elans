"use client";

import { useEffect } from "react";

/**
 * If React ever has to re-render the whole page in the browser (a recovered hydration mismatch, which can
 * happen when Safari is still parsing a large page as the scripts start), the viewport tag from the server
 * HTML is dropped. Without it phones fall back to a zoomed-out desktop width, so put it back.
 */
export function ViewportGuard() {
  useEffect(() => {
    if (document.querySelector('meta[name="viewport"]')) return;
    const m = document.createElement("meta");
    m.name = "viewport";
    m.content = "width=device-width, initial-scale=1";
    document.head.prepend(m);
  }, []);
  return null;
}
