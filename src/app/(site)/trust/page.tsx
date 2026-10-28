import type { Metadata } from "next";
import { getCatalogue } from "@/lib/content";
import { Callout, CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 300;
export const metadata: Metadata = { title: "Trust: security, privacy and AI governance", description: "The controls Elans actually runs: tenant isolation, MFA, encryption, audit logs, approval gates, prompt-injection defences, data-protection workflows and no training on client data. No certification claims.", alternates: { canonical: "/trust" } };

export default async function Trust() {
  const { settings } = await getCatalogue();
  const sections: { icon: string; title: string; items: string[] }[] = [
    { icon: "lock", title: "Data security", items: ["Each client's data is isolated in the database with row-level security; isolation is tested automatically on every change", "Encryption in transit (TLS) and at rest", "Multi-factor authentication required for Elans staff and client administrators", "Role-based access control; personal data masked by role", "Integration credentials stored as references to a secrets vault, never in application tables", "Staff access to a client account requires a time-limited, audited access grant"] },
    { icon: "shield", title: "Privacy & data protection", items: ["Built to Kenya's Data Protection Act, 2019 and its regulations", "Consent recorded by purpose and channel; marketing consent is always separate and optional", "Access, correction and erasure requests tracked against statutory deadlines", "A shared suppression list stops all messaging to people who opt out or are erased", "72-hour breach assessment and notification workflow", "Retention schedules with approved, logged deletion", `ODPC registration: ${settings.odpcRegistration ?? "in progress (number published here once issued)"}`] },
    { icon: "spark", title: "AI governance", items: ["Client data is never used to train AI models", "Personal data redacted before model calls where possible", "Every AI output validated against a schema and given a confidence score; uncertain outputs go to a person", "Approval gates for irreversible, financial, filing and customer-facing actions; autonomy is opt-in per action type", "Customer messages and documents are treated as data, never as instructions (prompt-injection defence)", "Each agent has an allow-list of tools it may use", "Evaluation sets per solution, re-run on every prompt or model change", "Full audit trail: input hash, output, model, prompt version and reviewer"] },
    { icon: "eye", title: "Human oversight", items: ["No automated clinical, legal, credit, hiring or dismissal decisions", "High-risk workflows are flagged 'Human review required' in assessments and proposals", "Kill switch per automation and per account, available to clients", "Named accountable engineer for every automation"] },
    { icon: "route", title: "Reliability & recovery", items: ["Idempotency keys and duplicate detection on every event", "Retries with backoff, timeouts and rate limits on every integration", "Monitoring, alerting and incident management with severity levels", "Backups with tested restores", "Separate development, staging and production environments"] },
    { icon: "globe", title: "Data residency & sub-processors", items: ["The data region is recorded per client account", "Cross-border transfers are assessed and documented in our data processing agreement", "Health and public-sector data are assessed for in-country requirements before onboarding", "A sub-processor list is provided with the data processing agreement"] },
  ];
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Trust" }]} eyebrow="Security, privacy & AI governance" title="The controls we actually run" lead="No badges, no borrowed logos. This page describes the safeguards built into the Elans platform and our way of working. Ask us for evidence of any of them." />
      <Section className="pt-10">
        <Container>
          <Callout tone="neutral" title="Certifications">
            Elans does not currently hold SOC 2, ISO 27001 or similar certifications, and we will not display them until we do. We are happy to complete your security questionnaire.
          </Callout>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {sections.map((s) => (
              <section key={s.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6" aria-labelledby={`t-${s.icon}`}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-sand text-brown"><Icon name={s.icon} /></span>
                  <h2 id={`t-${s.icon}`} className="text-xl font-semibold text-heading">{s.title}</h2>
                </div>
                <CheckList className="mt-5 text-[0.95rem]" items={s.items} />
              </section>
            ))}
          </div>
        </Container>
      </Section>
      <Section tone="sand">
        <Container className="max-w-3xl">
          <Eyebrow>Responsible disclosure</Eyebrow>
          <h2 className="mt-2 font-display text-3xl font-semibold">Found a security issue?</h2>
          <p className="mt-3 text-muted">Please report it through our contact form with the topic &quot;Security&quot;. We will acknowledge within two business days and keep you informed.</p>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
