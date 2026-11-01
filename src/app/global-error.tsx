"use client";

/** Last-resort error screen when the root layout itself fails. Self-contained (no app CSS guaranteed). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FCFCFC", color: "#242424", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, padding: 16 }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <p style={{ color: "#8C1D47", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 13 }}>Something went wrong</p>
          <h1 style={{ color: "#2B0012", fontSize: 30 }}>Elans is having a problem</h1>
          <p>Please try again in a moment. Reference: <code>{error.digest ?? "n/a"}</code></p>
          <button onClick={reset} style={{ background: "#6A012A", color: "#fff", border: 0, borderRadius: 999, padding: "12px 22px", fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
