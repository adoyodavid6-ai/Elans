import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { Container, Section } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { CatalogueBrowser, type CatalogueItem } from "@/components/site/CatalogueBrowser";
import { priceLabel } from "@/components/site/Price";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "AI automation solutions catalogue",
  description: "Browse Elans AI automation and AI agent solutions by business function, industry, complexity, status and starting price: finance, eTIMS compliance, M-Pesa reconciliation, collections, WhatsApp agents, voice receptionists and more.",
  alternates: { canonical: "/solutions" },
};

export default async function SolutionsPage() {
  const cat = await getCatalogue();
  const items: CatalogueItem[] = cat.solutions.map((s) => {
    const c = cat.categories.find((x) => x.slug === s.category);
    const pkg = s.pricing.package;
    const setup = pkg !== "quoted" ? cat.packages.find((p) => p.key === pkg) : undefined;
    return {
      slug: s.slug,
      name: s.name,
      summary: s.summary,
      href: `/solutions/${s.category}/${s.slug}`,
      category: s.category,
      categoryName: c?.name ?? "",
      division: s.division,
      industries: s.industries,
      complexity: s.complexity,
      timeline: s.timeline,
      status: s.status,
      priceBand: pkg === "enterprise" ? "quoted" : pkg,
      priceLabel: setup && pkg !== "enterprise" ? `from ${priceLabel(cat, setup.setupKey).text}` : "Quoted",
      search: [s.name, s.summary, s.problem, c?.name, ...s.keywords, ...s.capabilities].join(" ").toLowerCase(),
    };
  });
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { label: "Solutions" }]}
        eyebrow="Elans Automate · Elans Converse"
        title="Solutions catalogue"
        lead={`${cat.solutions.length} automation and AI agent solutions across ${cat.categories.length} business functions. Each one shows its problem, its before-and-after workflow, the approvals people keep, and its real status.`}
      />
      <Section className="pt-10 sm:pt-12">
        <Container>
          <Suspense fallback={<p className="text-muted">Loading catalogue…</p>}>
            <CatalogueBrowser
              items={items}
              categories={cat.categories.map((c) => ({ value: c.slug, label: c.name }))}
              industries={cat.industries.map((i) => ({ value: i.slug, label: i.short }))}
              divisions={cat.divisions.filter((d) => cat.solutions.some((s) => s.division === d.key)).map((d) => ({ value: d.key, label: d.name }))}
            />
          </Suspense>
        </Container>
      </Section>
      <Section tone="sand" labelledBy="by-function">
        <Container>
          <h2 id="by-function" className="font-display text-2xl font-semibold">
            Browse by business function
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {cat.categoryGroups.map((g) => (
              <div key={g.key}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-copper-ink">{g.name}</p>
                <ul className="mt-2 space-y-1.5">
                  {cat.categories
                    .filter((c) => c.group === g.key)
                    .map((c) => (
                      <li key={c.slug}>
                        <Link href={`/solutions/${c.slug}`} className="text-[0.95rem] text-espresso hover:underline">
                          {c.name} <span className="text-muted">({cat.solutions.filter((s) => s.category === c.slug).length})</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </Section>
      <FinalCta title="Not sure which solution fits?" body="The free AI Opportunity Assessment scores the catalogue against your business and explains its reasoning." />
    </>
  );
}
