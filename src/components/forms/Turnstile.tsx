"use client";

import Script from "next/script";

/** Renders Cloudflare Turnstile only when a site key is configured. */
export function Turnstile() {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!key) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={key} data-theme="light" />
    </>
  );
}
