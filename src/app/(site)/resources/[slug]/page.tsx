import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { Container, Faqs, Section, Pill } from "@/components/ui/primitives";
import { Markdown } from "@/components/ui/Markdown";
import { PageHeader } from "@/components/site/PageHeader";
import { SolutionCard } from "@/components/site/SolutionCard";
import { JsonLd } from "@/components/site/JsonLd";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.resources.map((r) => ({ slug: r.slug }));
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = (await getCatalogue()).resources.find((x) => x.slug === slug);
  return r ? { title: r.title, description: r.summary, alternates: { canonical: `/resources/${r.slug}` }, openGraph: { type: "article", publishedTime: r.published } } : {};
}

export default async function ResourcePage({ params }: Props) {
  const { slug } = await params;
  const cat = await getCatalogue();
  const r = cat.resources.find((x) => x.slug === slug);
  if (!r) notFound();
  const related = r.related.map((s) => cat.solutions.find((x) => x.slug === s)).filter(Boolean) as typeof cat.solutions;
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: r.title, description: r.summary, datePublished: r.published, author: { "@type": "Organization", name: "Elans" }, publisher: { "@type": "Organization", name: "Elans" } }} />
      {r.faqs && <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: r.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />}
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { href: "/resources", label: "Resources" }, { label: r.title }]} eyebrow={<span className="flex items-center gap-2"><Pill tone="copper">{r.category}</Pill> {r.readingMinutes} min read</span>} title={r.title} lead={r.summary}>
        <p className="mt-4 text-sm text-muted">Published {new Date(r.published).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} by the Elans team</p>
      </PageHeader>
      <Section className="pt-10">
        <Container className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          <article>
            <Markdown source={r.body} />
            {r.faqs && (
              <div className="mt-10">
                <h2 className="mb-4 font-display text-2xl font-semibold">Questions</h2>
                <Faqs items={r.faqs} />
              </div>
            )}
          </article>
          {related.length > 0 && (
            <aside className="space-y-4 self-start">
              <p className="text-xs font-semibold uppercase tracking-wide text-copper-ink">Related solutions</p>
              {related.map((s) => <SolutionCard key={s.slug} s={s} cat={cat} />)}
            </aside>
          )}
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
