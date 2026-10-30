import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { Container, Section, Eyebrow } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { PackageFrom } from "@/components/site/Price";
import { FinalCta } from "@/components/site/FinalCta";
import { Icon } from "@/components/ui/Icon";

export const revalidate = 60;
export const metadata: Metadata = { title: "Industries", description: "AI automation and growth for healthcare, SACCOs and lenders, schools, property, hospitality, retail, construction, logistics, NGOs and more, built around how each sector works in Kenya and East Africa.", alternates: { canonical: "/industries" } };

export default async function IndustriesPage() {
  const cat = await getCatalogue();
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Industries" }]} eyebrow="Industry pathways" title="Built around how your sector works" lead="Each industry page sets out the specific challenges, the leaks, the automations that pay back first and the compliance points that matter, in Kenya and beyond." />
      <Section className="pt-10 sm:pt-12">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cat.industries.map((i) => (
              <li key={i.slug}>
                <Link href={`/industries/${i.slug}`} className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                  <h2 className="text-lg font-semibold text-heading group-hover:underline">{i.name}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{i.summary}</p>
                  <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-copper-ink">
                    {i.solutions.length} relevant solutions <Icon name="arrow-right" size={14} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <Section tone="sand" id="packs" labelledBy="packs-h">
        <Container>
          <Eyebrow>Industry Packs</Eyebrow>
          <h2 id="packs-h" className="mt-2 font-display text-3xl font-semibold">
            Bundled solutions for your sector
          </h2>
          <p className="mt-3 max-w-2xl text-muted">Packs combine the solutions that work best together in a sector, delivered as one programme with one owner metric per workflow.</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cat.packs.map((p) => (
              <li key={p.slug} className="relative flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-6">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-copper-ink">{cat.industries.find((i) => i.slug === p.industry)?.short}</p>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="mt-2 text-lg font-semibold text-heading">
                  <Link href={`/industries/${p.industry}/packs/${p.slug}`} className="after:absolute after:inset-0 hover:underline">
                    {p.name}
                  </Link>
                </h3>
                <p className="mt-2 flex-1 text-sm text-muted">{p.summary}</p>
                <div className="rule-blend-soft mt-4 border-t pt-3">
                  <PackageFrom cat={cat} pkg={p.package} compact className="text-xs" />
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
