import type { Metadata } from "next";
import { getCatalogue } from "@/lib/content";
import { Container, Section } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { AssessmentWizard } from "@/components/assessment/AssessmentWizard";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "AI Opportunity Assessment (free)", description: "A free 10-minute assessment that scores your automation and growth opportunities with the Elans Opportunity Score and explains its reasoning. Contact details only at the end.", alternates: { canonical: "/assessment" } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AssessmentPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cat = await getCatalogue();
  const initial: Record<string, unknown> = {};
  if (sp.industry && cat.industries.some((i) => i.slug === sp.industry)) initial.industry = sp.industry;
  const sol = sp.solution ? cat.solutions.find((s) => s.slug === sp.solution) : undefined;
  if (sol) initial.functions = sol.functions.filter((f) => f !== "custom").slice(0, 3);
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "AI Opportunity Assessment" }]} eyebrow="Free · about 10 minutes" title="AI Opportunity Assessment" lead="Answer a few questions about how your business works. You will get a scored report of your top automation and growth opportunities, with the reasoning shown.">
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {["No contact details until the last step", "Save and resume any time", "Scores explained, not hidden", "Hypotheses clearly labelled"].map((t) => (
            <li key={t} className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-brown" /> {t}</li>
          ))}
        </ul>
      </PageHeader>
      <Section className="pt-10">
        <Container>
          <AssessmentWizard industries={cat.industries.map((i) => ({ slug: i.slug, name: i.name, tasks: i.assessmentTasks }))} initial={{ answers: initial, step: 1 }} />
        </Container>
      </Section>
    </>
  );
}
