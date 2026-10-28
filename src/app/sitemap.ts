import type { MetadataRoute } from "next";
import { getCatalogue } from "@/lib/content";
import { completeness } from "@/lib/content/completeness";
import { calculators } from "@/lib/core/roi";
import { LEGAL } from "@/content/seed/legal";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cat = await getCatalogue();
  const u = (path: string, priority = 0.6): MetadataRoute.Sitemap[number] => ({ url: `${site()}${path}`, changeFrequency: "weekly", priority });
  const statics = ["", "/solutions", "/industries", "/growth", "/growth/ai-visibility-check", "/frontier", "/templates", "/how-it-works", "/pricing", "/case-studies", "/resources", "/integrations", "/trust", "/partners", "/about", "/careers", "/contact", "/assessment", "/roi", "/sessions"];
  return [
    ...statics.map((p) => u(p, p === "" ? 1 : p === "/assessment" || p === "/solutions" ? 0.9 : 0.7)),
    ...cat.categories.map((c) => u(`/solutions/${c.slug}`, 0.7)),
    // Incomplete solution pages render noindex, so they are left out of the sitemap too.
    ...cat.solutions.filter((s) => completeness(s).complete).map((s) => u(`/solutions/${s.category}/${s.slug}`, 0.8)),
    ...cat.industries.map((i) => u(`/industries/${i.slug}`, 0.7)),
    ...cat.packs.map((p) => u(`/industries/${p.industry}/packs/${p.slug}`, 0.6)),
    ...cat.growthServices.map((g) => u(`/growth/${g.slug}`, 0.7)),
    ...cat.frontierTopics.map((t) => u(`/frontier/${t.slug}`, 0.5)),
    ...cat.templates.map((t) => u(`/templates/${t.slug}`, 0.5)),
    ...cat.resources.map((r) => u(`/resources/${r.slug}`, 0.5)),
    ...cat.packages.map((p) => u(`/pricing/${p.key}`, 0.6)),
    ...calculators.map((c) => u(`/roi/${c.slug}`, 0.6)),
    ...Object.keys(LEGAL).map((d) => u(`/legal/${d}`, 0.2)),
  ];
}
