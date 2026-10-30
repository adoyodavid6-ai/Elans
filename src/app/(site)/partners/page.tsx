import type { Metadata } from "next";
import { ButtonLink, CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { PartnerForm } from "@/components/forms/PartnerForm";

export const metadata: Metadata = { title: "Partners & white-label", description: "Elans Partners: white-label AI agents and automations, and a referral programme, for agencies, accounting firms and consultants.", alternates: { canonical: "/partners" } };

export default function Partners() {
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Partners" }]} eyebrow={<span className="flex items-center gap-3">Elans Partners <StatusBadge status="planned" /></span>} title="Offer AI automation under your own brand" lead="Agencies, accounting firms and consultants can refer clients or resell Elans agents and automations under their own brand. Elans runs the platform, monitoring and engineering underneath." />
      <Section className="pt-12">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-8">
            {[
              { t: "Referral programme", s: "planned" as const, items: ["Introduce clients; we deliver and support them", "Referral fee on first-year setup fees (terms on application)", "Co-branded assessment links so you can track referrals"] },
              { t: "White-label programme", s: "planned" as const, items: ["Your brand on agents, client portal and reports", "Your clients in separate, isolated accounts under your partner account", "Elans engineers build and run; you own the client relationship", "Partner pricing with your own margin"] },
            ].map((p) => (
              <section key={p.t} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-2xl font-bold">{p.t}</h2>
                  <StatusBadge status={p.s} />
                </div>
                <CheckList className="mt-4" items={p.items} />
              </section>
            ))}
            <div>
              <Eyebrow>Who it suits</Eyebrow>
              <CheckList className="mt-3" items={["Digital and marketing agencies", "Accounting and tax firms (eTIMS work especially)", "IT and ERP consultants", "Business associations and SACCO networks"]} />
            </div>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">Register interest</h2>
            <p className="mt-2 text-sm text-muted">The programme is opening to a small first cohort. We will contact you within five business days.</p>
            <PartnerForm />
          </div>
        </Container>
      </Section>
      <Section tone="sand">
        <Container className="text-center">
          <ButtonLink href="/sessions" variant="secondary">Prefer to talk? Book a Discovery Call</ButtonLink>
        </Container>
      </Section>
    </>
  );
}
