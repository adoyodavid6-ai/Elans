import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { calculators, getCalculator } from "@/lib/core/roi";
import { getCatalogue } from "@/lib/content";
import { Container, Section } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { RoiCalculatorView } from "@/components/roi/RoiCalculatorView";
import { priceLabel } from "@/components/site/Price";

export function generateStaticParams() {
  return calculators.map((c) => ({ calculator: c.slug }));
}
type Props = { params: Promise<{ calculator: string }>; searchParams: Promise<Record<string, string | undefined>> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { calculator } = await params;
  const c = getCalculator(calculator);
  return c ? { title: c.name, description: c.summary, alternates: { canonical: `/roi/${c.slug}` } } : {};
}

export default async function CalculatorPage({ params, searchParams }: Props) {
  const { calculator } = await params;
  const sp = await searchParams;
  const c = getCalculator(calculator);
  if (!c) notFound();
  const cat = await getCatalogue();
  const initial: Record<string, number> = Object.fromEntries(c.fields.map((f) => [f.key, f.default]));
  // Live package prices for the master calculator's default solution cost.
  if (c.slug === "master") {
    initial.implementationFee = priceLabel(cat, "launch.setup").amount ?? initial.implementationFee;
    initial.monthlyFee = priceLabel(cat, "launch.monthly").amount ?? initial.monthlyFee;
  }
  for (const f of c.fields) if (sp[f.key] !== undefined && Number.isFinite(Number(sp[f.key]))) initial[f.key] = Number(sp[f.key]);
  const solution = c.solution ? cat.solutions.find((s) => s.slug === c.solution) : undefined;
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { href: "/roi", label: "ROI calculators" }, { label: c.short }]} eyebrow="ROI calculator" title={c.name} lead={c.summary}>
        {solution && (
          <p className="mt-4 text-sm text-muted">
            Related solution: <Link href={`/solutions/${solution.category}/${solution.slug}`} className="font-semibold text-copper-ink underline">{solution.name}</Link>
          </p>
        )}
      </PageHeader>
      <Section className="pt-10">
        <Container>
          <RoiCalculatorView slug={c.slug} initial={initial} />
        </Container>
      </Section>
    </>
  );
}
