import { getCatalogue } from "@/lib/content";
import { completeness } from "@/lib/content/completeness";

/** llms.txt: a plain-language map of the site for AI assistants and answer engines (GEO). Facts only; no claims we cannot support. */
export const revalidate = 3600;

export async function GET() {
  const cat = await getCatalogue();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const lines: string[] = [
    "# Elans",
    "",
    `> ${cat.settings.tagline} Elans designs, builds and runs AI automation and growth systems for organisations in Kenya and East Africa, with human approval on customer-facing and financial actions.`,
    "",
    "Key facts:",
    "- Divisions: " + cat.divisions.map((d) => `${d.name} (${d.tagline})`).join("; "),
    "- Each solution page states a status: Live, Pilot, Planned or Custom assessment.",
    "- Prices shown are indicative \"from\" prices in KES; final prices are quoted after a Diagnostic.",
    "- Elans does not use client data to train AI models. Elans does not claim certifications it does not hold.",
    "- Case studies and testimonials are published only with client permission; examples on the site are labelled \"Illustrative example\".",
    "",
    "## Start here",
    `- [AI Opportunity Assessment](${site}/assessment): 10-step assessment producing a ranked report of automation opportunities`,
    `- [ROI calculators](${site}/roi): low/base/high estimates separating capacity from cash`,
    `- [How Elans works](${site}/how-it-works)`,
    `- [Pricing](${site}/pricing)`,
    `- [Trust & security](${site}/trust)`,
    `- [Contact](${site}/contact)`,
    "",
    "## Solution categories",
    ...cat.categories.map((c) => `- [${c.name}](${site}/solutions/${c.slug}): ${c.summary}`),
    "",
    "## Solutions",
    ...cat.solutions.filter((s) => completeness(s).complete).map((s) => `- [${s.name}](${site}/solutions/${s.category}/${s.slug}) (${s.status}): ${s.summary}`),
    "",
    "## Industries",
    ...cat.industries.map((i) => `- [${i.name}](${site}/industries/${i.slug}): ${i.summary}`),
    "",
    "## Growth services",
    ...cat.growthServices.map((g) => `- [${g.name}](${site}/growth/${g.slug}): ${g.summary}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
