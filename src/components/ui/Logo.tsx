/**
 * The growing brown tree: roots = systems, trunk = platform, canopy = growth.
 * Three concepts for David to choose from at Stage 1 (see /brand). Concept A is the default.
 */
export type LogoConcept = "a" | "b" | "c";

export function TreeMark({ concept = "a", size = 32, title }: { concept?: LogoConcept; size?: number; title?: string }) {
  const label = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  if (concept === "b") {
    // Branching nodes: a trunk that splits into connected nodes (systems that grow).
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...label}>
        <rect width="48" height="48" rx="12" fill="#35271F" />
        <path d="M24 40V24M24 24l-8-8M24 24l8-8M24 30l-6-4M24 30l6-4M16 16v-4M32 16v-4" stroke="#B98258" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="16" cy="11" r="3" fill="#FAF8F5" />
        <circle cx="32" cy="11" r="3" fill="#FAF8F5" />
        <circle cx="24" cy="18" r="3.2" fill="#EAE1D7" />
        <circle cx="18" cy="26" r="2.2" fill="#EAE1D7" />
        <circle cx="30" cy="26" r="2.2" fill="#EAE1D7" />
        <path d="M18 41h12" stroke="#6B4936" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (concept === "c") {
    // Monogram: an E whose arms are branches growing from a single trunk.
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" {...label}>
        <rect width="48" height="48" rx="12" fill="#FAF8F5" stroke="#6B4936" strokeWidth="2" />
        <path d="M17 38V10" stroke="#6B4936" strokeWidth="4" strokeLinecap="round" />
        <path d="M17 12c6 0 10-2 14-5M17 24c5 0 9-1 12-3M17 36c6 0 10 1 14 4" stroke="#B98258" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <circle cx="32.5" cy="6.5" r="2.6" fill="#35271F" />
        <circle cx="30.5" cy="20" r="2.2" fill="#35271F" />
      </svg>
    );
  }
  // Concept A — Rooted canopy
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...label}>
      <rect width="48" height="48" rx="12" fill="#6B4936" />
      <circle cx="24" cy="17" r="10.5" fill="#B98258" />
      <circle cx="16.5" cy="21" r="6" fill="#B98258" />
      <circle cx="31.5" cy="21" r="6" fill="#B98258" />
      <path d="M24 22v11" stroke="#FAF8F5" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 26l-4.5-3.5M24 28l4.5-3.5" stroke="#FAF8F5" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 33c-3 0-6 2-9 4M24 33c3 0 6 2 9 4M24 33v5" stroke="#EAE1D7" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Wordmark({ concept = "a", className = "", tone = "dark" }: { concept?: LogoConcept; className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <TreeMark concept={concept} size={32} />
      <span className={`font-display text-[1.45rem] font-semibold tracking-tight ${tone === "light" ? "text-ivory" : "text-espresso"}`} style={{ fontVariationSettings: '"opsz" 72' }}>
        Elans
      </span>
    </span>
  );
}
