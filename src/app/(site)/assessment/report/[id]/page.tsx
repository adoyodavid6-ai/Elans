import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { internal } from "@/lib/db";
import type { ReportSections } from "@/lib/engines/assessment";
import { getCatalogue } from "@/lib/content";
import { ButtonLink, Callout, Container, Eyebrow, Section, cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { IntegrationBadge, StatusBadge } from "@/components/ui/Status";
import { PackageFrom } from "@/components/site/Price";
import { PrintButton } from "@/components/assessment/PrintButton";
import { TreeMark } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Your AI Opportunity report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

/** Visual language for the three kinds of statement (§9.2). */
function Kind({ k, ai = true }: { k: "told" | "estimate" | "hypothesis"; ai?: boolean }) {
  const m = {
    told: ["You told us", "bg-brown text-white"],
    estimate: ["Calculated estimate", "bg-copper text-espresso"],
    hypothesis: [ai ? "AI-generated hypothesis · to be validated" : "Hypothesis · to be validated", "border border-dashed border-espresso/40 bg-white text-espresso"],
  }[k];
  return <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide", m[1])}>{m[0]}</span>;
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const row = await internal(async (tx) => {
    const [r] = await tx<{ sections: ReportSections; created_at: Date }[]>`select sections, created_at from reports where public_token = ${id}`;
    return r;
  }).catch(() => null);
  if (!row) notFound();
  const r = row.sections;
  const cat = await getCatalogue();
  const isAi = r.generator !== "rules";

  return (
    <div className="bg-ivory">
      <Section className="pt-8 sm:pt-12">
        <Container className="max-w-5xl">
          <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link href="/assessment" className="text-sm text-muted hover:underline">← Assessment</Link>
            <PrintButton />
          </div>

          <header className="rounded-[2rem] surface-brand p-6 text-sand sm:p-10">
            <div className="flex items-center gap-3">
              <TreeMark size={36} onBrand />
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-copper">Elans · Preliminary AI Opportunity report</p>
            </div>
            <h1 className="mt-5 font-display text-3xl font-bold text-ivory sm:text-5xl">{r.organisation}</h1>
            <p className="mt-2 text-sand/80">{r.industryName} · prepared {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            <div className="mt-6 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <Kind k="hypothesis" ai={isAi} />
              <p className="mt-2 text-lg text-ivory">{r.summaryHypothesis}</p>
            </div>
          </header>

          <section aria-label="How to read this report" className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["told", "Facts you gave us, repeated back so you can check them."],
              ["estimate", "Arithmetic on your answers. The formula is shown. Not a guarantee."],
              ["hypothesis", isAi ? "Generated with AI from your answers. Ideas to validate, not findings." : "Ideas to validate, generated from your answers by rules. Not findings."],
            ].map(([k, d]) => (
              <div key={k} className="rounded-2xl border border-line bg-white p-4">
                <Kind k={k as "told"} ai={isAi} />
                <p className="mt-2 text-sm text-muted">{d}</p>
              </div>
            ))}
          </section>

          {r.exclusions.length > 0 && (
            <Callout tone="warning" className="mt-6" title="Some things you mentioned need a human decision">
              <ul className="list-disc pl-5">
                {r.exclusions.map((e) => (
                  <li key={e.topic}>
                    <strong>{e.topic}:</strong> {e.reason}
                  </li>
                ))}
              </ul>
            </Callout>
          )}

          <section className="mt-12" aria-labelledby="opps-h">
            <Eyebrow>Top automation opportunities</Eyebrow>
            <h2 id="opps-h" className="mt-2 font-display text-3xl font-bold">Ranked by the Elans Opportunity Score</h2>
            <p className="mt-2 text-sm text-muted">Scored 0–100 across 11 weighted criteria (weights version {r.weightVersion ?? "default"}). Scores compare options for your business; they are not probabilities of success.</p>
            {r.opportunities.length === 0 ? (
              <Callout tone="info" className="mt-6">No catalogue solution matched strongly. That usually means a custom design. A Strategy Session is the best next step.</Callout>
            ) : (
              <ol className="mt-6 space-y-5">
                {r.opportunities.map((o, i) => (
                  <li key={o.slug} className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <span className="font-display text-3xl font-bold text-copper">{i + 1}</span>
                        <div>
                          <h3 className="text-xl font-semibold text-heading">
                            <Link href={o.href} className="hover:underline">{o.name}</Link>
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                            <StatusBadge status={o.status as "pilot"} />
                            <span className="capitalize">{o.complexity} complexity</span> · <span>{o.timeline}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Kind k="estimate" />
                        <p className="mt-1 font-display text-4xl font-bold text-heading">{o.score}<span className="text-lg text-muted">/100</span></p>
                      </div>
                    </div>
                    {o.flag === "human_review" && (
                      <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-bg p-3 text-sm text-warning">
                        <Icon name="shield" size={16} className="mt-0.5 shrink-0" /> Human review required{o.flagReason ? `: ${o.flagReason}` : "."}
                      </p>
                    )}
                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Why it scores this way</p>
                        <p className="mt-1 text-sm">{o.rationale}</p>
                        <ul className="mt-3 space-y-1.5">
                          {o.topCriteria.map((c) => (
                            <li key={c.label} className="text-sm">
                              <div className="flex justify-between"><span>{c.label}</span><span className="font-semibold">{c.points.toFixed(1)} pts</span></div>
                              <div className="mt-1 h-1.5 rounded-full bg-sand"><div className="h-full rounded-full bg-copper" style={{ width: `${Math.min(100, (c.points / 14) * 100)}%` }} /></div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-dashed border-espresso/30 p-4">
                        <Kind k="hypothesis" ai={isAi} />
                        <p className="mt-2 text-sm">{o.hypothesis}</p>
                      </div>
                    </div>
                    <div className="rule-blend-soft mt-5 grid gap-5 border-t pt-5 text-sm md:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Likely integrations</p>
                        <ul className="mt-2 space-y-1">
                          {o.integrations.map((x) => (
                            <li key={x.name} className="flex items-center justify-between gap-2">{x.name} <IntegrationBadge status={x.status as "planned"} /></li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Risks</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">{(o.risks.length ? o.risks : ["No specific risks flagged from your answers"]).map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Dependencies</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">{o.dependencies.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    </div>
                    <div className="no-print mt-5 flex flex-wrap gap-3">
                      <ButtonLink href={o.roiHref} variant="secondary" size="sm" icon="calculator">Estimate ROI with your numbers</ButtonLink>
                      <ButtonLink href={o.href} variant="ghost" size="sm" icon="arrow-right">Solution details</ButtonLink>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-2" aria-label="Estimates and growth">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <Kind k="estimate" />
              <h2 className="mt-2 font-display text-2xl font-bold">Indicative ROI inputs</h2>
              <ul className="mt-4 space-y-4">
                {r.estimates.map((e) => (
                  <li key={e.label}>
                    <p className="text-sm text-muted">{e.label}</p>
                    <p className="text-xl font-semibold text-heading">{e.value}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted">{e.formula}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <Eyebrow>Growth opportunities</Eyebrow>
              {r.growth.length === 0 ? (
                <p className="mt-3 text-sm text-muted">You did not select growth goals. Explore <Link href="/growth" className="underline">Elans Grow</Link> any time.</p>
              ) : (
                <ul className="mt-3 space-y-4">
                  {r.growth.map((g) => (
                    <li key={g.slug}>
                      <Link href={g.href} className="font-semibold text-heading hover:underline">{g.name}</Link>
                      <div className="mt-1.5 rounded-xl border border-dashed border-espresso/30 p-3 text-sm">
                        <Kind k="hypothesis" ai={isAi} />
                        <p className="mt-1.5">{g.hypothesis}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.2fr]" aria-label="Recommendation and next steps">
            <div className="rounded-[var(--radius-card)] bg-teal-50 p-6">
              <Eyebrow>Recommended package</Eyebrow>
              <p className="mt-2 font-display text-2xl font-bold">{r.package.name}</p>
              <p className="mt-2 text-sm">{r.package.reason}</p>
              <div className="mt-3"><PackageFrom cat={cat} pkg={r.package.key as "launch"} /></div>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <Eyebrow>Next steps</Eyebrow>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{r.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
              <div className="no-print mt-5 flex flex-wrap gap-3">
                <ButtonLink href="/sessions?type=strategy" icon="arrow-right">Book a Strategy Session</ButtonLink>
                <ButtonLink href="/sessions?type=discovery" variant="secondary">Free Discovery Call</ButtonLink>
              </div>
            </div>
          </section>

          <section className="mt-12 rounded-[var(--radius-card)] border border-line bg-white p-6" aria-labelledby="told-h">
            <Kind k="told" />
            <h2 id="told-h" className="mt-2 font-display text-2xl font-bold">What you told us</h2>
            <dl className="mt-4 divide-y divide-line text-sm">
              {r.toldUs.map((t) => (
                <div key={t.label} className="grid gap-1 py-2.5 sm:grid-cols-[12rem_1fr]">
                  <dt className="text-muted">{t.label}</dt>
                  <dd className="text-heading">{t.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="mt-8 text-xs leading-relaxed text-muted">
            This preliminary report is generated automatically from your answers. Scores and estimates are indicative and are not guarantees of savings, revenue or outcomes. It is not legal, tax, financial or medical advice. Generator: {r.generator}.
          </p>
        </Container>
      </Section>
    </div>
  );
}
