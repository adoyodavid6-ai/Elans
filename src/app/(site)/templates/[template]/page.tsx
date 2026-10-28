import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { ButtonLink, Card, CheckList, Container, Eyebrow, Section, Pill } from "@/components/ui/primitives";
import { IntegrationBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.templates.map((t) => ({ template: t.slug }));
}
type Props = { params: Promise<{ template: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { template } = await params;
  const t = (await getCatalogue()).templates.find((x) => x.slug === template);
  return t ? { title: `${t.name} template`, description: t.problem } : {};
}

export default async function TemplatePage({ params }: Props) {
  const { template } = await params;
  const cat = await getCatalogue();
  const t = cat.templates.find((x) => x.slug === template);
  if (!t) notFound();
  const s = t.solution ? cat.solutions.find((x) => x.slug === t.solution) : undefined;
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { href: "/templates", label: "Templates" }, { label: t.name }]}
        eyebrow={<span className="flex items-center gap-2">Template <Pill>v{t.version}</Pill> <Pill tone="copper">{t.maintenance}</Pill></span>}
        title={t.name}
        lead={t.problem}
        actions={
          <ButtonLink href={`/contact?topic=template&template=${t.slug}`} icon="arrow-right">
            Request implementation
          </ButtonLink>
        }
      />
      <Section className="pt-12">
        <Container className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-8">
            <section>
              <Eyebrow>Workflow</Eyebrow>
              <p className="mt-3 text-lg leading-relaxed">{t.workflow}</p>
            </section>
            <section>
              <Eyebrow>Prerequisites</Eyebrow>
              <CheckList className="mt-3" items={t.prerequisites} />
            </section>
            <section>
              <Eyebrow>Supported integrations</Eyebrow>
              <ul className="mt-3 space-y-2">
                {t.integrations.map((slug) => {
                  const i = cat.integrations.find((x) => x.slug === slug);
                  return i ? (
                    <li key={slug} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-2.5 text-sm">
                      {i.name} <IntegrationBadge status={i.status} />
                    </li>
                  ) : null;
                })}
              </ul>
            </section>
          </div>
          <aside>
            <Card>
              <dl className="space-y-3 text-sm">
                {[
                  ["Division", cat.divisions.find((d) => d.key === t.division)?.name],
                  ["Complexity", t.complexity],
                  ["Estimated setup", t.setupTime],
                  ["Security classification", t.securityClass],
                  ["Pricing model", t.pricingModel],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium capitalize text-heading">{v}</dd>
                  </div>
                ))}
              </dl>
              {s && (
                <Link href={`/solutions/${s.category}/${s.slug}`} className="mt-4 inline-block text-sm font-semibold text-copper-ink hover:underline">
                  Solution: {s.name} →
                </Link>
              )}
            </Card>
          </aside>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
