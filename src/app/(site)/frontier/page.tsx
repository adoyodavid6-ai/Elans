import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { Container, Section } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export const metadata: Metadata = { title: "Frontier: emerging business needs", description: "AI search visibility, agentic commerce, AI governance for SMEs, data protection operations, eTIMS enforcement, Swahili voice AI and other shifts businesses should prepare for now.", alternates: { canonical: "/frontier" } };

export default async function FrontierPage() {
  const cat = await getCatalogue();
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Frontier" }]} eyebrow="Emerging needs hub" title="What is changing, and what to do about it now" lead="The shifts we see coming for businesses in Kenya, East Africa and beyond, with practical first steps and an honest status for what Elans offers today." />
      <Section className="pt-12">
        <Container>
          <ul className="grid gap-4 md:grid-cols-2">
            {cat.frontierTopics.map((t, i) => (
              <li key={t.slug} className="relative flex gap-5 rounded-[var(--radius-card)] border border-line bg-white p-6 transition hover:shadow-[var(--shadow-soft)]">
                <span className="font-display text-3xl font-semibold text-copper">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-heading">
                      <Link href={`/frontier/${t.slug}`} className="after:absolute after:inset-0 hover:underline">
                        {t.name}
                      </Link>
                    </h2>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted">{t.summary}</p>
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
