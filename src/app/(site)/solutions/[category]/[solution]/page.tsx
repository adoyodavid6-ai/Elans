import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { completeness } from "@/lib/content/completeness";
import { ButtonLink, Callout, Card, CheckList, Container, Eyebrow, Faqs, Section, TextLink, cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { IntegrationBadge, StatusBadge, IllustrativeTag } from "@/components/ui/Status";
import { BeforeAfter, FlowLegend } from "@/components/ui/WorkflowDiagram";
import { PageHeader } from "@/components/site/PageHeader";
import { PackageFrom } from "@/components/site/Price";
import { SolutionCard } from "@/components/site/SolutionCard";
import { JsonLd } from "@/components/site/JsonLd";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.solutions.map((s) => ({ category: s.category, solution: s.slug }));
}
type Props = { params: Promise<{ category: string; solution: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { solution } = await params;
  const s = (await getCatalogue()).solutions.find((x) => x.slug === solution);
  if (!s) return {};
  const { complete } = completeness(s);
  return {
    title: s.name,
    description: s.summary,
    alternates: { canonical: `/solutions/${s.category}/${s.slug}` },
    robots: complete ? undefined : { index: false, follow: true },
  };
}

const RISK = {
  standard: { label: "Standard", detail: "Routine data and reversible actions." },
  elevated: { label: "Elevated", detail: "Financial or customer-facing actions; approval gates apply." },
  high: { label: "High", detail: "Decisions with significant impact on people. A person always decides." },
};

export default async function SolutionPage({ params }: Props) {
  const { category, solution } = await params;
  const cat = await getCatalogue();
  const s = cat.solutions.find((x) => x.slug === solution);
  if (!s) notFound();
  if (s.category !== category) redirect(`/solutions/${s.category}/${s.slug}`);
  const c = cat.categories.find((x) => x.slug === s.category)!;
  const division = cat.divisions.find((d) => d.key === s.division);
  const integrations = s.integrations.map((slug) => cat.integrations.find((i) => i.slug === slug)).filter(Boolean) as typeof cat.integrations;
  const related = s.related.map((r) => cat.solutions.find((x) => x.slug === r)).filter(Boolean) as typeof cat.solutions;
  const relatedGrowth = s.related.map((r) => cat.growthServices.find((x) => x.slug === r)).filter(Boolean) as typeof cat.growthServices;
  const relatedPacks = cat.packs.filter((p) => p.includes.includes(s.slug));
  const industries = s.industries.map((i) => cat.industries.find((x) => x.slug === i)).filter(Boolean) as typeof cat.industries;
  const templates = cat.templates.filter((t) => t.solution === s.slug);
  const pkg = s.pricing.package !== "quoted" ? cat.packages.find((p) => p.key === s.pricing.package) : undefined;

  const sections = [
    ["problem", "The problem"],
    ["workflow", "Before & after"],
    ["capabilities", "Capabilities"],
    ["data", "Data & integrations"],
    ["results", "Benefits & success measures"],
    ["approvals", "Human approval points"],
    ["delivery", "Delivery & pricing"],
    ["faqs", "FAQs"],
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: s.name,
          description: s.summary,
          serviceType: c.name,
          provider: { "@type": "Organization", name: "Elans" },
          areaServed: ["KE", "East Africa"],
        }}
      />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: s.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { href: "/solutions", label: "Solutions" }, { href: `/solutions/${c.slug}`, label: c.name }, { label: s.name }]}
        eyebrow={
          <span className="flex flex-wrap items-center gap-3">
            {division?.name} <StatusBadge status={s.status} />
          </span>
        }
        title={s.name}
        lead={s.summary}
        actions={
          <>
            <ButtonLink href={`/assessment?solution=${s.slug}`} icon="arrow-right">
              Assess my fit
            </ButtonLink>
            <ButtonLink href={`/contact?topic=quote&solution=${s.slug}`} variant="secondary">
              Request a quotation
            </ButtonLink>
          </>
        }
        aside={
          <Card className="bg-white">
            <dl className="divide-y divide-line text-sm">
              {[
                ["Starting price", <PackageFrom key="p" cat={cat} pkg={s.pricing.package} />],
                ["Indicative timeline", s.timeline],
                ["Implementation complexity", <span key="c" className="capitalize">{s.complexity}</span>],
                ["Risk class", `${RISK[s.riskClass].label}: ${RISK[s.riskClass].detail}`],
                ["Owner metric", s.ownerMetric],
              ].map(([k, v]) => (
                <div key={k as string} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8.5rem_1fr] sm:gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium text-heading">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        }
      />

      <div className="border-b border-line bg-white/70">
        <Container>
          <nav aria-label="On this page" className="-mx-4 flex gap-1 overflow-x-auto px-4 py-2 text-sm">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-sand/60 hover:text-espresso">
                {label}
              </a>
            ))}
          </nav>
        </Container>
      </div>

      <Section className="pt-12 sm:pt-16">
        <Container className="grid gap-14">
          {s.humanReviewRequired && (
            <Callout tone="warning" title="Human review required">
              {s.humanReviewRequired}
            </Callout>
          )}

          <section id="problem" className="grid scroll-mt-24 gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <Eyebrow>1 · Problem statement</Eyebrow>
              <h2 className="mt-2 font-display text-3xl font-semibold">The problem</h2>
              <p className="mt-4 text-lg leading-relaxed text-text">{s.problem}</p>
            </div>
            <div className="rounded-[var(--radius-card)] bg-sand/50 p-6">
              <Eyebrow>2 · Businesses most affected</Eyebrow>
              <CheckList className="mt-4 text-[0.95rem]" items={s.affected} />
            </div>
          </section>

          <section id="workflow" className="scroll-mt-24">
            <Eyebrow>3–4 · Current vs automated workflow</Eyebrow>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-3xl font-semibold">Before & after</h2>
              <FlowLegend />
            </div>
            <BeforeAfter className="mt-6" before={s.manualFlow} after={s.automatedFlow} />
          </section>

          <section id="capabilities" className="scroll-mt-24">
            <Eyebrow>5 · Main capabilities</Eyebrow>
            <h2 className="mt-2 font-display text-3xl font-semibold">What it does</h2>
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {s.capabilities.map((cap) => (
                <li key={cap} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
                  <Icon name="bolt" className="mt-0.5 shrink-0 text-copper" size={18} />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="data" className="grid scroll-mt-24 gap-8 lg:grid-cols-2">
            <div>
              <Eyebrow>6 · Required data</Eyebrow>
              <h2 className="mt-2 font-display text-3xl font-semibold">What we need from you</h2>
              <CheckList className="mt-5" items={s.dataRequired} />
            </div>
            <div>
              <Eyebrow>Integrations (real status)</Eyebrow>
              <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
                {integrations.map((i) => (
                  <li key={i.slug} className="flex items-start justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium text-heading">{i.name}</span>
                      {i.note && <span className="block text-xs text-muted">{i.note}</span>}
                    </span>
                    <IntegrationBadge status={i.status} />
                  </li>
                ))}
              </ul>
              <Link href="/integrations" className="mt-2 inline-block text-sm text-copper-ink hover:underline">
                What these statuses mean →
              </Link>
            </div>
          </section>

          <section id="results" className="grid scroll-mt-24 gap-8 lg:grid-cols-2">
            <div>
              <Eyebrow>7 · Expected operational benefits</Eyebrow>
              <h2 className="mt-2 font-display text-3xl font-semibold">Benefits</h2>
              <CheckList className="mt-5" items={s.benefits} />
              <p className="mt-4 text-xs text-muted">Benefits are described qualitatively. We measure your actual results against a baseline captured before go-live.</p>
            </div>
            <div className="rounded-[var(--radius-card)] bg-espresso p-6 text-sand">
              <Eyebrow tone="light">8 · Success indicators</Eyebrow>
              <p className="mt-3 text-sm text-sand/70">Owner metric</p>
              <p className="font-display text-xl font-semibold text-ivory">{s.ownerMetric}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {s.successIndicators.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Icon name="chart" size={16} className="mt-0.5 text-copper" /> {x}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="approvals" className="scroll-mt-24">
            <Eyebrow>9 · Human approval points</Eyebrow>
            <h2 className="mt-2 font-display text-3xl font-semibold">What people stay in control of</h2>
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {s.approvalPoints.map((a) => (
                <li key={a} className="flex gap-3 rounded-2xl border border-espresso/15 bg-white p-4">
                  <Icon name="shield" className="mt-0.5 shrink-0 text-brown" size={18} />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="delivery" className="grid scroll-mt-24 gap-6 lg:grid-cols-3">
            <Card>
              <Eyebrow>10 · Complexity</Eyebrow>
              <p className="mt-2 text-2xl font-semibold capitalize text-heading">{s.complexity}</p>
              <div className="mt-3 flex gap-1" aria-hidden>
                {["low", "medium", "high"].map((lvl, i) => (
                  <span key={lvl} className={cx("h-2 flex-1 rounded-full", i <= ["low", "medium", "high"].indexOf(s.complexity) ? "bg-brown" : "bg-sand")} />
                ))}
              </div>
            </Card>
            <Card>
              <Eyebrow>11 · Indicative timeline</Eyebrow>
              <p className="mt-2 text-2xl font-semibold text-heading">{s.timeline}</p>
              <p className="mt-2 text-sm text-muted">From signed design to the start of the supervised Prove period.</p>
            </Card>
            <Card>
              <Eyebrow>12 · Pricing approach</Eyebrow>
              <p className="mt-2 text-sm text-text">{s.pricing.approach}</p>
              <div className="mt-3">
                <PackageFrom cat={cat} pkg={s.pricing.package} />
              </div>
              {pkg && (
                <Link href={`/pricing/${pkg.key}`} className="mt-3 inline-block text-sm font-semibold text-copper-ink hover:underline">
                  What {pkg.name} includes →
                </Link>
              )}
            </Card>
          </section>

          <section aria-labelledby="demo-h" className="rounded-[var(--radius-card)] border border-dashed border-copper/60 bg-copper/5 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Eyebrow>13 · Demo</Eyebrow>
                <h2 id="demo-h" className="mt-2 font-display text-2xl font-semibold">
                  See it working
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted">
                  {s.demo ? "The demo uses illustrative data in a sandbox. It is not a client deployment." : "A demo of this solution is available on request during a Strategy Session."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <IllustrativeTag />
                {s.demo ? (
                  <ButtonLink href={s.demo.href} prefetch={s.demo.href.startsWith("/portal") ? false : undefined} icon="arrow-right" className="h-auto! min-h-11 whitespace-normal! py-2 text-center">
                    {s.demo.label}
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/sessions" variant="secondary">
                    Book a demo session
                  </ButtonLink>
                )}
              </div>
            </div>
          </section>

          <section id="faqs" className="grid scroll-mt-24 gap-8 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <Eyebrow>14 · FAQs</Eyebrow>
              <h2 className="mt-2 font-display text-3xl font-semibold">Questions about {s.name}</h2>
            </div>
            <Faqs items={s.faqs} />
          </section>
        </Container>
      </Section>

      {(related.length > 0 || industries.length > 0) && (
        <Section tone="sand" labelledBy="related-h">
          <Container>
            <h2 id="related-h" className="font-display text-2xl font-semibold">
              Related solutions
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.slice(0, 6).map((r) => (
                <li key={r.slug}>
                  <SolutionCard s={r} cat={cat} />
                </li>
              ))}
            </ul>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-copper-ink">Industries</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {industries.map((i) => (
                    <li key={i.slug}>
                      <Link href={`/industries/${i.slug}`} className="inline-block rounded-full bg-white px-3 py-1 text-sm ring-1 ring-line hover:ring-sand-strong">
                        {i.short}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {(relatedPacks.length > 0 || relatedGrowth.length > 0) && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-copper-ink">Packs & services</p>
                  <ul className="mt-2 space-y-1">
                    {relatedPacks.map((p) => (
                      <li key={p.slug}>
                        <Link href={`/industries/${p.industry}/packs/${p.slug}`} className="text-sm hover:underline">
                          {p.name}
                        </Link>
                      </li>
                    ))}
                    {relatedGrowth.map((g) => (
                      <li key={g.slug}>
                        <Link href={`/growth/${g.slug}`} className="text-sm hover:underline">
                          {g.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {templates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-copper-ink">Templates</p>
                  <ul className="mt-2 space-y-1">
                    {templates.map((t) => (
                      <li key={t.slug}>
                        <TextLink href={`/templates/${t.slug}`}>{t.name}</TextLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Container>
        </Section>
      )}
      <FinalCta title={`Is ${s.name} right for you?`} body="Take the free assessment to see how it scores against your business, or request a fixed-scope quotation." />
    </>
  );
}
