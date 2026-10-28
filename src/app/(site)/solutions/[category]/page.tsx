import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { ButtonLink, Container, Section } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { SolutionCard } from "@/components/site/SolutionCard";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.categories.map((c) => ({ category: c.slug }));
}
type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const c = (await getCatalogue()).categories.find((x) => x.slug === category);
  if (!c) return {};
  return { title: `${c.name} automation`, description: c.summary, alternates: { canonical: `/solutions/${c.slug}` } };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const cat = await getCatalogue();
  const c = cat.categories.find((x) => x.slug === category);
  if (!c) notFound();
  const list = cat.solutions.filter((s) => s.category === c.slug).sort((a, b) => (a.gapRank ?? 50) - (b.gapRank ?? 50) || Number(b.status === "pilot") - Number(a.status === "pilot"));
  const group = cat.categoryGroups.find((g) => g.key === c.group);
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { href: "/solutions", label: "Solutions" }, { label: c.name }]}
        eyebrow={group?.name}
        title={`${c.name}`}
        lead={c.intro}
        actions={
          <>
            <ButtonLink href={`/assessment`} icon="arrow-right">
              Assess my {c.name.toLowerCase().split(" ")[0]} processes
            </ButtonLink>
            <ButtonLink href="/sessions" variant="secondary">
              Talk to us
            </ButtonLink>
          </>
        }
      />
      <Section className="pt-10 sm:pt-12">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <li key={s.slug}>
                <SolutionCard s={s} cat={cat} showCategory={false} />
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
