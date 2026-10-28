import type { SiteSettings } from "@/content/seed/settings";

/** Structured data for search engines and AI assistants (GEO). Content is serialised safely. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function organisationLd(s: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.brand,
    alternateName: s.descriptor,
    slogan: s.tagline,
    url: site(),
    logo: `${site()}/icon.svg`,
    description:
      "Elans is an AI automation and growth company based in Nairobi, Kenya. It finds operational and growth inefficiencies in businesses, builds AI automation, AI agents and marketing systems to close them, and runs them against measurable results.",
    areaServed: ["Kenya", "East Africa", "Worldwide"],
    address: { "@type": "PostalAddress", addressLocality: "Nairobi", addressCountry: "KE" },
    ...(s.email ? { email: s.email } : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    knowsAbout: ["AI automation", "AI agents", "WhatsApp Business automation", "KRA eTIMS compliance", "M-Pesa reconciliation", "Generative Engine Optimisation", "Growth marketing"],
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${site()}${it.path}` })),
  };
}
