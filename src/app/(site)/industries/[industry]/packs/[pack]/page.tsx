import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { ButtonLink, CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { PackageFrom } from "@/components/site/Price";
import { SolutionCard } from "@/components/site/SolutionCard";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.packs.map((p) => ({ industry: p.industry, pack: p.slug }));
}
type Props = { params: Promise<{ industry: string; pack: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pack } = await params;
  const p = (await getCatalogue()).packs.find((x) => x.slug === pack);
  return p ? { title: p.name, description: p.summary, alternates: { canonical: `/industries/${p.industry}/packs/${p.slug}` } } : {};
}

export default async function PackPage({ params }: Props) {
  const { industry, pack } = await params;
  const cat = await getCatalogue();
  const p = cat.packs.find((x) => x.slug === pack && x.industry === industry);
  if (!p) notFound();
  const ind = cat.industries.find((i) => i.slug === p.industry)!;
  const included = p.includes.map((s) => cat.solutions.find((x) => x.slug === s)).filter(Boolean) as typeof cat.solutions;
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { href: "/industries", label: "Industries" }, { href: `/industries/${ind.slug}`, label: ind.short }, { label: p.name }]}
        eyebrow={
          <span className="flex items-center gap-3">
            Industry Pack <StatusBadge status={p.status} />
          </span>
        }
        title={p.name}
        lead={p.summary}
        actions={
          <>
            <ButtonLink href={`/contact?topic=quote&pack=${p.slug}`} icon="arrow-right">
              Request a quotation
            </ButtonLink>
            <ButtonLink href={`/assessment?industry=${ind.slug}`} variant="secondary">
              Assess my fit first
            </ButtonLink>
          </>
        }
        aside={
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
            <Eyebrow>Starting price</Eyebrow>
            <div className="mt-2">
              <PackageFrom cat={cat} pkg={p.package} />
            </div>
            <p className="mt-4 text-sm text-muted">Ideal for: {p.idealFor}</p>
          </div>
        }
      />
      <Section className="pt-12">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <Eyebrow>Outcomes we measure</Eyebrow>
              <CheckList className="mt-4" items={p.outcomes} />
              <p className="mt-4 text-xs text-muted">Each workflow gets an owner metric and a baseline in the Automation Diagnostic.</p>
            </div>
            <div>
              <Eyebrow>Included solutions</Eyebrow>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {included.map((s) => (
                  <li key={s.slug}>
                    <SolutionCard s={s} cat={cat} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-10 text-sm text-muted">
            Back to <Link href={`/industries/${ind.slug}`} className="text-copper-ink underline">{ind.name}</Link>
          </p>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
