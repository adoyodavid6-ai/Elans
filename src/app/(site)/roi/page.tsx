import type { Metadata } from "next";
import Link from "next/link";
import { calculators } from "@/lib/core/roi";
import { Container, Section } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const metadata: Metadata = { title: "ROI calculators", description: "Transparent automation ROI calculators with every formula shown: master calculator with low/base/high scenarios, missed calls, WhatsApp leakage, reconciliation hours, eTIMS exposure, SHA claims, collections and content cost.", alternates: { canonical: "/roi" } };

export default function RoiHub() {
  const [master, ...rest] = calculators;
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "ROI calculators" }]} eyebrow="Estimate before you spend" title="ROI calculators with nothing hidden" lead="Every calculator shows its formulas and assumptions, separates time freed from cash saved, and gives low, base and high cases. Estimates only. No guarantees." />
      <Section className="pt-10">
        <Container>
          <Link href={`/roi/${master.slug}`} className="group flex flex-col gap-4 rounded-[2rem] bg-espresso p-6 text-sand sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper">Start here</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-ivory">{master.name}</h2>
              <p className="mt-2 max-w-2xl text-sand/80">{master.summary}</p>
            </div>
            <span className="inline-flex items-center gap-2 font-semibold text-copper group-hover:underline">Open <Icon name="arrow-right" /></span>
          </Link>
          <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((c) => (
              <li key={c.slug}>
                <Link href={`/roi/${c.slug}`} className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 transition hover:shadow-[var(--shadow-soft)]">
                  <Icon name="calculator" className="text-brown" />
                  <h2 className="mt-3 text-lg font-semibold text-heading">{c.name}</h2>
                  <p className="mt-2 flex-1 text-sm text-muted">{c.summary}</p>
                  <span className="mt-4 text-sm font-semibold text-copper-ink">Open calculator →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
