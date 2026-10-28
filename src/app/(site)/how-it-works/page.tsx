import type { Metadata } from "next";
import { method } from "@/content/seed/method";
import { ButtonLink, CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";
import { FlowLegend } from "@/components/ui/WorkflowDiagram";

export const metadata: Metadata = { title: "How it works: the Elans Method", description: "Discover, Diagnose, Design, Build, Prove, Run: how Elans delivers AI automation with a measured baseline, approval gates, a supervised Prove period and monthly reporting.", alternates: { canonical: "/how-it-works" } };

export default function HowItWorks() {
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "How It Works" }]} eyebrow="The Elans Method" title="Prove one workflow. Then scale what works." lead="Six stages, the same for every client. We measure before we build, supervise before we hand over, and report every month after." actions={<><ButtonLink href="/assessment" icon="arrow-right">Start with Discover</ButtonLink><ButtonLink href="/sessions" variant="secondary">Book a Strategy Session</ButtonLink></>} />
      <Section className="pt-12">
        <Container>
          <ol className="relative space-y-6 before:absolute before:left-6 before:top-4 before:h-[calc(100%-2rem)] before:w-px before:bg-line md:before:left-8">
            {method.map((m, i) => (
              <li key={m.key} className="relative grid gap-4 pl-16 md:grid-cols-[1fr_1.2fr] md:pl-24">
                <span className="absolute left-0 top-0 grid h-12 w-12 place-items-center rounded-full bg-espresso font-display text-lg font-semibold text-ivory md:h-16 md:w-16 md:text-2xl">{i + 1}</span>
                <div>
                  <h2 className="font-display text-2xl font-semibold">{m.name}</h2>
                  <p className="text-sm font-medium text-copper-ink">{m.duration}</p>
                  <p className="mt-2 text-muted">{m.summary}</p>
                </div>
                <div className="rounded-2xl border border-line bg-white p-5">
                  <CheckList className="text-sm" items={[...m.detail]} />
                  <p className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-sm font-semibold text-heading">
                    <Icon name="doc" size={16} className="text-copper" /> You receive: {m.output}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
      <Section tone="sand" labelledBy="principles-h">
        <Container>
          <Eyebrow>Engineering principles</Eyebrow>
          <h2 id="principles-h" className="mt-2 font-display text-3xl font-semibold">How we build so it keeps working</h2>
          <div className="mt-4"><FlowLegend /></div>
          <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["layers", "Rules for money, AI for language", "Money, tax, statutory calculations, approvals and permissions run as deterministic code. AI reads, classifies, summarises and drafts."],
              ["shield", "Approval gates by default", "Irreversible, financial, filing and customer-facing actions wait for a person unless you opt in to autonomy for that action type."],
              ["target", "Confidence thresholds", "Every AI output carries a confidence score. Below the threshold it goes to a review queue, never straight through."],
              ["check", "Evaluation sets", "Each solution has a test set built from your real examples, run on every prompt or model change."],
              ["doc", "Full audit trail", "Input hash, output, model, prompt version and reviewer are recorded for every step."],
              ["lock", "Prompt-injection defences", "Customer messages and documents are treated as data, never instructions. Each agent has an allow-list of tools."],
              ["power", "Kill switches", "Per automation and per account, available to you in the portal."],
              ["money", "Cost meters and budgets", "Per-client usage metering with budgets and alerts, so costs never surprise you."],
              ["route", "Idempotency and retries", "Duplicate events are detected; failed steps retry with backoff, then raise an incident."],
            ].map(([icon, t, b]) => (
              <li key={t} className="rounded-2xl bg-white p-5 ring-1 ring-line">
                <Icon name={icon} className="text-brown" />
                <p className="mt-2 font-semibold text-heading">{t}</p>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
