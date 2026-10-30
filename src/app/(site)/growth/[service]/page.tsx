import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { ButtonLink, Card, CheckList, Container, Eyebrow, Faqs, Section } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { priceLabel, PackageFrom, IndicativeTag } from "@/components/site/Price";
import { FinalCta } from "@/components/site/FinalCta";
import { JsonLd } from "@/components/site/JsonLd";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.growthServices.map((g) => ({ service: g.slug }));
}
type Props = { params: Promise<{ service: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service } = await params;
  const g = (await getCatalogue()).growthServices.find((x) => x.slug === service);
  return g ? { title: g.name, description: g.summary, alternates: { canonical: `/growth/${g.slug}` } } : {};
}

export default async function GrowthServicePage({ params }: Props) {
  const { service } = await params;
  const cat = await getCatalogue();
  const g = cat.growthServices.find((x) => x.slug === service);
  if (!g) notFound();
  const div = cat.divisions.find((d) => d.key === g.division);
  const tier = cat.growTiers.find((t) => t.key === g.pricing.tier);
  const tierPrice = tier ? priceLabel(cat, tier.priceKey) : null;
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", name: g.name, description: g.summary, provider: { "@type": "Organization", name: "Elans" } }} />
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { href: "/growth", label: "Growth & Marketing" }, { label: g.name }]}
        eyebrow={
          <span className="flex items-center gap-3">
            {div?.name} <StatusBadge status={g.status} />
          </span>
        }
        title={g.name}
        lead={g.summary}
        actions={
          <>
            <ButtonLink href={`/contact?topic=grow&service=${g.slug}`} icon="arrow-right">
              Talk to the growth team
            </ButtonLink>
            {g.slug === "ai-visibility-geo" && (
              <ButtonLink href="/growth/ai-visibility-check" variant="secondary">
                Free AI Visibility Check
              </ButtonLink>
            )}
          </>
        }
      />
      <Section className="pt-12">
        <Container className="grid gap-14">
          <section className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <Eyebrow>Why it matters</Eyebrow>
              <p className="mt-3 text-lg leading-relaxed">{g.problem}</p>
            </div>
            <Card className="bg-teal-50">
              <Eyebrow>Pricing</Eyebrow>
              <p className="mt-2 text-sm">{g.pricing.approach}</p>
              {tier && tierPrice && (
                <p className="mt-3 font-semibold text-heading">
                  {tier.name} from {tierPrice.text}/month {!tierPrice.confirmed && <IndicativeTag />}
                </p>
              )}
              {!tier && g.pricing.tier !== "quoted" && <PackageFrom cat={cat} pkg={g.pricing.tier as "launch"} className="mt-3 block" />}
            </Card>
          </section>
          <section>
            <Eyebrow>How we work</Eyebrow>
            <ol className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {g.approach.map((a, i) => (
                <li key={a.title} className="rounded-2xl border border-line bg-white p-5">
                  <span className="font-display text-2xl font-semibold text-copper">{i + 1}</span>
                  <p className="mt-1 font-semibold text-heading">{a.title}</p>
                  <p className="mt-1.5 text-sm text-muted">{a.detail}</p>
                </li>
              ))}
            </ol>
          </section>
          <section className="grid gap-6 lg:grid-cols-3">
            <Card>
              <Eyebrow>Deliverables</Eyebrow>
              <CheckList className="mt-4 text-sm" items={g.deliverables} />
            </Card>
            <Card>
              <Eyebrow>KPIs we report</Eyebrow>
              <ul className="mt-4 space-y-2 text-sm">
                {g.kpis.map((k) => (
                  <li key={k} className="flex gap-2">
                    <Icon name="chart" size={16} className="mt-0.5 text-copper" /> {k}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <Eyebrow>Guardrails</Eyebrow>
              <ul className="mt-4 space-y-2 text-sm">
                {g.guardrails.map((k) => (
                  <li key={k} className="flex gap-2">
                    <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-brown" /> {k}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
          <section className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
            <h2 className="font-display text-3xl font-semibold">FAQs</h2>
            <Faqs items={g.faqs} />
          </section>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
