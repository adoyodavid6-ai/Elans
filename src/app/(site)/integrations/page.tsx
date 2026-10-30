import type { Metadata } from "next";
import { getCatalogue } from "@/lib/content";
import { Container, Section } from "@/components/ui/primitives";
import { IntegrationBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export const metadata: Metadata = { title: "Integrations", description: "Systems Elans connects to, with honest status: Supported, Planned or Custom assessment. WhatsApp, M-Pesa Daraja, KRA eTIMS, QuickBooks, Xero, Microsoft 365, Google Workspace and more.", alternates: { canonical: "/integrations" } };

export default async function IntegrationsPage() {
  const cat = await getCatalogue();
  const groups = [...new Set(cat.integrations.map((i) => i.category))];
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Integrations" }]} eyebrow="Integration directory" title="What we connect to, honestly labelled" lead="Statuses come straight from our records. We never imply an official partnership or certification with any vendor." />
      <Section className="pt-10">
        <Container>
          <dl className="mb-10 grid gap-3 md:grid-cols-3">
            {[
              ["supported", "Supported", "Adaptor implemented and tested in the Elans platform against the provider's sandbox or file format."],
              ["planned", "Planned", "Designed; built or certified for production when the first client needs it, or awaiting provider approval."],
              ["custom_assessment", "Custom assessment", "Depends on your specific system, version or hosting; assessed in the Diagnostic."],
            ].map(([k, l, d]) => (
              <div key={k} className="rounded-2xl border border-line bg-white p-4">
                <dt><IntegrationBadge status={k as "supported"} /></dt>
                <dd className="mt-2 text-sm text-muted"><span className="sr-only">{l}: </span>{d}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-10">
            {groups.map((g) => (
              <section key={g} aria-labelledby={`g-${g}`}>
                <h2 id={`g-${g}`} className="font-display text-2xl font-bold">{g}</h2>
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {cat.integrations.filter((i) => i.category === g).map((i) => (
                    <li key={i.slug} className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-white p-4">
                      <div>
                        <p className="font-semibold text-heading">{i.name}</p>
                        {i.note && <p className="mt-1 text-sm text-muted">{i.note}</p>}
                        <p className="mt-1 text-xs text-muted">Used by {cat.solutions.filter((s) => s.integrations.includes(i.slug)).length} solutions</p>
                      </div>
                      <IntegrationBadge status={i.status} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
