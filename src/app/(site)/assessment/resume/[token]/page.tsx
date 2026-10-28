import type { Metadata } from "next";
import { getCatalogue } from "@/lib/content";
import { loadAssessmentByToken } from "@/app/actions/assessment";
import { ButtonLink, Container, EmptyState, Section } from "@/components/ui/primitives";
import { AssessmentWizard } from "@/components/assessment/AssessmentWizard";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata: Metadata = { title: "Resume your assessment", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default async function Resume({ params }: Props) {
  const { token } = await params;
  const row = await loadAssessmentByToken(token);
  const cat = await getCatalogue();
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { href: "/assessment", label: "AI Opportunity Assessment" }, { label: "Resume" }]} title="Welcome back" lead="Your answers have been restored. Pick up where you left off." />
      <Section className="pt-10">
        <Container>
          {row && row.state === "draft" ? (
            <AssessmentWizard industries={cat.industries.map((i) => ({ slug: i.slug, name: i.name, tasks: i.assessmentTasks }))} initial={{ answers: row.answers, step: row.current_step, id: row.id, token }} />
          ) : (
            <EmptyState icon="clock" title={row ? "This assessment has already been submitted" : "We couldn't find that assessment"} action={<ButtonLink href="/assessment">Start a new assessment</ButtonLink>}>
              {row ? "Your report link was sent to the email you provided." : "The link may be incomplete or expired."}
            </EmptyState>
          )}
        </Container>
      </Section>
    </>
  );
}
