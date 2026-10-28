import type { Metadata } from "next";
import { CheckList, Container, Section, Callout } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { VisibilityCheck } from "@/components/growth/VisibilityCheck";

export const metadata: Metadata = { title: "Free AI Visibility Check", description: "See whether an AI assistant mentions your business when customers ask for recommendations. A free sample snapshot from Elans Grow, not a full audit.", alternates: { canonical: "/growth/ai-visibility-check" } };

export default function AiVisibilityCheck() {
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { href: "/growth", label: "Growth & Marketing" }, { label: "AI Visibility Check" }]} eyebrow="Free tool · Elans Grow" title="Do AI assistants recommend you?" lead="Ask an AI assistant the questions your customers ask, and see whether your business appears in the answer and which sources it relies on." />
      <Section className="pt-10">
        <Container className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
            <VisibilityCheck />
          </div>
          <aside className="space-y-4">
            <Callout tone="info" title="What this is, and is not">
              A sample snapshot from one AI model with web search, accessed through its API. It is not a full audit, results differ from consumer apps, and answers vary between runs. We show the date and model used.
            </Callout>
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="font-semibold text-heading">A full AI Visibility audit adds</p>
              <CheckList className="mt-3 text-sm" items={["Several assistants and dozens of questions", "Accuracy review of how you are described", "Entity, schema and content fixes", "Monthly tracking over time"]} />
            </div>
          </aside>
        </Container>
      </Section>
    </>
  );
}
