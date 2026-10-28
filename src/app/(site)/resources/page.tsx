import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { Container, Section, Pill } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export const metadata: Metadata = { title: "Resources: guides, checklists and insights", description: "Practical guides on eTIMS, WhatsApp commerce, automation ROI, GEO and data protection for businesses in Kenya and East Africa.", alternates: { canonical: "/resources" } };

const KIND = { guide: "Guide", comparison: "Comparison", industry: "Industry workflow", checklist: "Checklist", glossary: "Glossary" } as const;

export default async function Resources() {
  const cat = await getCatalogue();
  const list = [...cat.resources].sort((a, b) => b.published.localeCompare(a.published));
  const categories = [...new Set(list.map((r) => r.category))];
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Resources" }]} eyebrow="Insights" title="Practical guides, no hype" lead="Answer-first guides and checklists on automation, compliance and growth. Every statistic we use is sourced and dated." />
      <Section className="pt-10">
        <Container>
          <ul className="mb-8 flex flex-wrap gap-2" aria-label="Categories">
            {categories.map((c) => (
              <li key={c}><Pill tone="white">{c}</Pill></li>
            ))}
          </ul>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((r) => (
              <li key={r.slug} className="relative flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 transition hover:shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Pill tone="copper">{KIND[r.kind]}</Pill> {r.readingMinutes} min read
                </div>
                <h2 className="mt-3 text-lg font-semibold leading-snug text-heading">
                  <Link href={`/resources/${r.slug}`} className="after:absolute after:inset-0 hover:underline">{r.title}</Link>
                </h2>
                <p className="mt-2 flex-1 text-sm text-muted">{r.summary}</p>
                <p className="mt-4 text-xs text-muted">{new Date(r.published).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
