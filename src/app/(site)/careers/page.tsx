import type { Metadata } from "next";
import { CheckList, Container, EmptyState, Eyebrow, Section, ButtonLink } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata: Metadata = { title: "Careers", description: "Work at Elans: automation engineers, growth marketers and delivery consultants building accountable AI systems in Nairobi.", alternates: { canonical: "/careers" } };

export default function Careers() {
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Careers" }]} eyebrow="Careers" title="Build systems that businesses depend on" lead="We are a small founding team in Nairobi. We value engineering discipline, clear writing, honesty about what works and care for the people our systems affect." />
      <Section className="pt-12">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Open roles</Eyebrow>
            <div className="mt-4">
              <EmptyState icon="users" title="No open roles right now" action={<ButtonLink href="/contact?topic=careers" variant="secondary">Introduce yourself</ButtonLink>}>
                We expect to hire automation engineers, a growth marketer and a delivery consultant as client work grows.
              </EmptyState>
            </div>
          </div>
          <div>
            <Eyebrow>How we work</Eyebrow>
            <CheckList className="mt-4" items={["Prove one, then scale: we ship small and measure", "Deterministic code for money; AI where it genuinely helps", "Every automation has a named owner", "We write things down: decisions, runbooks, post-mortems", "Hybrid working from Nairobi"]} />
          </div>
        </Container>
      </Section>
    </>
  );
}
