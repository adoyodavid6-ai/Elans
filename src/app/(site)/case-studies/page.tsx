import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { Callout, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { IllustrativeTag } from "@/components/ui/Status";
import { BeforeAfter } from "@/components/ui/WorkflowDiagram";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export const metadata: Metadata = { title: "Case studies", description: "Elans publishes client results only once they are measured against an agreed baseline. Until then, these illustrative workflow examples show what changes.", alternates: { canonical: "/case-studies" } };

export default async function CaseStudies() {
  const cat = await getCatalogue();
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Case studies" }]} eyebrow="Case studies" title="Results we will publish only when they are real" lead="Elans is a new company. We will not invent logos, testimonials or savings. When first clients complete their Prove period, their measured results, with permission, will appear here." />
      <Section className="pt-10">
        <Container>
          <Callout tone="info" title="Status">
            {cat.settings.caseStudyDate ? `First client results publishing from ${cat.settings.caseStudyDate}.` : "First client results will be published after the first Prove periods complete. Date to be confirmed."} Each case study will state the baseline, the owner metric, the measurement period and what was not achieved.
          </Callout>
          <div className="mt-12 space-y-16">
            {cat.examples.map((e) => {
              const s = cat.solutions.find((x) => x.slug === e.solution);
              return (
                <article key={e.slug} aria-labelledby={`ex-${e.slug}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <IllustrativeTag />
                    <Eyebrow>{cat.industries.find((i) => i.slug === e.industry)?.short}</Eyebrow>
                  </div>
                  <h2 id={`ex-${e.slug}`} className="mt-3 font-display text-3xl font-semibold">{e.title}</h2>
                  <p className="mt-2 max-w-3xl text-muted">{e.scenario}</p>
                  <BeforeAfter className="mt-6" before={e.before} after={e.after} />
                  <p className="mt-4 text-sm">
                    <span className="font-semibold">What we would measure:</span> {e.whatWeMeasure.join(" · ")}
                    {s && (
                      <>
                        {" "}· <Link href={`/solutions/${s.category}/${s.slug}`} className="font-semibold text-copper-ink underline">{s.name}</Link>
                      </>
                    )}
                  </p>
                </article>
              );
            })}
          </div>
        </Container>
      </Section>
      <FinalCta title="Want to be one of our first measured results?" body="Pilot clients get close attention from the founding team and an honest, published account of what worked." />
    </>
  );
}
