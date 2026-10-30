import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { ButtonLink, Card, CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { IntegrationBadge, StatusBadge } from "@/components/ui/Status";
import { WorkflowDiagram } from "@/components/ui/WorkflowDiagram";
import { PageHeader } from "@/components/site/PageHeader";
import { PackageFrom } from "@/components/site/Price";
import { FinalCta } from "@/components/site/FinalCta";
import { rankBySeedFit } from "@/lib/content/industry";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.industries.map((i) => ({ industry: i.slug }));
}
type Props = { params: Promise<{ industry: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { industry } = await params;
  const i = (await getCatalogue()).industries.find((x) => x.slug === industry);
  if (!i) return {};
  return { title: `AI automation for ${i.short.toLowerCase()}`, description: i.summary, alternates: { canonical: `/industries/${i.slug}` } };
}

export default async function IndustryPage({ params }: Props) {
  const { industry } = await params;
  const cat = await getCatalogue();
  const ind = cat.industries.find((x) => x.slug === industry);
  if (!ind) notFound();
  const solutions = rankBySeedFit(cat, ind);
  const integrations = ind.integrations.map((s) => cat.integrations.find((i) => i.slug === s)).filter(Boolean) as typeof cat.integrations;
  const packs = cat.packs.filter((p) => ind.packs.includes(p.slug));

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { href: "/industries", label: "Industries" }, { label: ind.short }]}
        eyebrow="Industry"
        title={ind.name}
        lead={ind.summary}
        actions={
          <>
            <ButtonLink href={`/assessment?industry=${ind.slug}`} icon="arrow-right">
              Assess my {ind.short.toLowerCase()} business
            </ButtonLink>
            <ButtonLink href="/sessions" variant="secondary">
              Book a Strategy Session
            </ButtonLink>
          </>
        }
      />
      <Section className="pt-12 sm:pt-16">
        <Container className="grid gap-14">
          <section className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <Eyebrow>Context</Eyebrow>
              <h2 className="mt-2 font-display text-3xl font-bold">What is happening in your sector</h2>
              <p className="mt-4 text-lg leading-relaxed">{ind.context}</p>
            </div>
            <Card className="bg-teal-50">
              <Eyebrow>Where revenue and time leak</Eyebrow>
              <ul className="mt-4 space-y-2.5">
                {ind.leakage.map((l) => (
                  <li key={l} className="flex gap-2.5 text-[0.95rem]">
                    <Icon name="alert" size={17} className="mt-0.5 shrink-0 text-danger" /> {l}
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section>
            <Eyebrow>Operational challenges</Eyebrow>
            <h2 className="mt-2 font-display text-3xl font-bold">The challenges we hear most</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {ind.challenges.map((c) => (
                <li key={c.title} className="rounded-2xl border border-line bg-white p-5">
                  <p className="font-semibold text-heading">{c.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-8 lg:grid-cols-2">
            <div>
              <Eyebrow>Frequent manual tasks</Eyebrow>
              <h2 className="mt-2 font-display text-2xl font-bold">Repetitive work worth automating</h2>
              <CheckList className="mt-5" items={ind.repetitiveTasks} />
            </div>
            <div>
              <Eyebrow>Suggested workflow architecture</Eyebrow>
              <WorkflowDiagram className="mt-4" flow={ind.architecture} title="How the pieces connect" />
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>High-value opportunities</Eyebrow>
                <h2 className="mt-2 font-display text-3xl font-bold">Where to start, in order</h2>
                <p className="mt-2 text-sm text-muted">Ordered by typical fit for {ind.short.toLowerCase()} and the Elans Opportunity Score. Your assessment re-ranks them for your business.</p>
              </div>
            </div>
            <ol className="mt-6 space-y-3">
              {solutions.map((s, idx) => (
                <li key={s.slug}>
                  <Link href={`/solutions/${s.category}/${s.slug}`} className="group grid gap-3 rounded-2xl border border-line bg-white p-5 transition hover:shadow-[var(--shadow-soft)] md:grid-cols-[3rem_1fr_auto] md:items-center">
                    <span className="font-display text-2xl font-bold text-copper">{String(idx + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-heading group-hover:underline">{s.name}</span>
                        <StatusBadge status={s.status} />
                      </span>
                      <span className="mt-1 block text-sm text-muted">{s.summary}</span>
                    </span>
                    <PackageFrom cat={cat} pkg={s.pricing.package} compact className="text-xs md:text-right" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section className="grid gap-8 lg:grid-cols-3">
            <Card>
              <Eyebrow>Growth & marketing</Eyebrow>
              <CheckList className="mt-4 text-sm" items={ind.growth} />
              <Link href="/growth" className="mt-4 inline-block text-sm font-semibold text-copper-ink hover:underline">
                Elans Grow →
              </Link>
            </Card>
            <Card>
              <Eyebrow>KPIs that matter</Eyebrow>
              <ul className="mt-4 space-y-2 text-sm">
                {ind.kpis.map((k) => (
                  <li key={k} className="flex gap-2">
                    <Icon name="chart" size={16} className="mt-0.5 text-copper" /> {k}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <Eyebrow>Security & compliance</Eyebrow>
              <ul className="mt-4 space-y-2 text-sm">
                {ind.compliance.map((k) => (
                  <li key={k} className="flex gap-2">
                    <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-brown" /> {k}
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section>
            <Eyebrow>Example integrations</Eyebrow>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {integrations.map((i) => (
                <li key={i.slug} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm">
                  <span className="font-medium">{i.name.replace(/ \(.*\)$/, "")}</span>
                  <IntegrationBadge status={i.status} />
                </li>
              ))}
            </ul>
          </section>

          {packs.length > 0 && (
            <section className="rounded-[var(--radius-card)] surface-brand p-6 text-sand sm:p-10">
              <Eyebrow tone="light">Industry Pack</Eyebrow>
              {packs.map((p) => (
                <div key={p.slug} className="mt-3 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
                  <div>
                    <h2 className="font-display text-3xl font-bold text-ivory">{p.name}</h2>
                    <p className="mt-2 text-sand/85">{p.summary}</p>
                    <p className="mt-3 text-sm text-sand/70">Ideal for: {p.idealFor}</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <PackageFrom cat={cat} pkg={p.package} className="text-sand/80 [&_.text-heading]:text-ivory" />
                    <ButtonLink href={`/industries/${ind.slug}/packs/${p.slug}`} variant="light" icon="arrow-right">
                      See what&apos;s in the pack
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </section>
          )}
        </Container>
      </Section>
      <FinalCta title={`Find the right starting point for your ${ind.short.toLowerCase()} business`} body="The assessment is pre-filled for your industry. Ten minutes, free, with a scored report." />
    </>
  );
}
