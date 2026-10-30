import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { ButtonLink, Card, CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.frontierTopics.map((t) => ({ topic: t.slug }));
}
type Props = { params: Promise<{ topic: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const t = (await getCatalogue()).frontierTopics.find((x) => x.slug === topic);
  return t ? { title: t.name, description: t.summary, alternates: { canonical: `/frontier/${t.slug}` } } : {};
}

export default async function FrontierTopicPage({ params }: Props) {
  const { topic } = await params;
  const cat = await getCatalogue();
  const t = cat.frontierTopics.find((x) => x.slug === topic);
  if (!t) notFound();
  const related = t.related
    .map((r) => {
      const [k, slug] = r.split(":");
      if (k === "s") {
        const s = cat.solutions.find((x) => x.slug === slug);
        return s && { href: `/solutions/${s.category}/${s.slug}`, name: s.name, summary: s.summary };
      }
      const g = cat.growthServices.find((x) => x.slug === slug);
      return g && { href: `/growth/${g.slug}`, name: g.name, summary: g.summary };
    })
    .filter(Boolean) as { href: string; name: string; summary: string }[];
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { href: "/frontier", label: "Frontier" }, { label: t.name }]} eyebrow={<span className="flex items-center gap-3">Frontier <StatusBadge status={t.status} /></span>} title={t.name} lead={t.summary} />
      <Section className="pt-12">
        <Container className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-10">
            <section>
              <Eyebrow>What is changing</Eyebrow>
              <p className="mt-3 text-lg leading-relaxed">{t.changing}</p>
            </section>
            <section>
              <Eyebrow>What to do now</Eyebrow>
              <CheckList className="mt-4" items={t.doNow} />
            </section>
            <section className="rounded-[var(--radius-card)] surface-brand p-6 text-sand">
              <Eyebrow tone="light">The Elans offer</Eyebrow>
              <p className="mt-2 text-lg text-ivory">{t.offer}</p>
              <ButtonLink href="/sessions" variant="light" className="mt-5">
                Discuss in a Strategy Session
              </ButtonLink>
            </section>
          </div>
          <aside className="space-y-4">
            <Card>
              <Eyebrow>Who it affects</Eyebrow>
              <CheckList className="mt-3 text-sm" items={t.affects} />
            </Card>
            {related.map((r) => (
              <Link key={r.href} href={r.href} className="block rounded-2xl border border-line bg-white p-5 hover:shadow-[var(--shadow-soft)]">
                <p className="font-semibold text-heading">{r.name}</p>
                <p className="mt-1 text-sm text-muted">{r.summary}</p>
              </Link>
            ))}
          </aside>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
