import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { Callout, Container, Section } from "@/components/ui/primitives";
import { Markdown } from "@/components/ui/Markdown";
import { PageHeader } from "@/components/site/PageHeader";
import { LEGAL } from "@/content/seed/legal";

export const revalidate = 300;
export function generateStaticParams() {
  return Object.keys(LEGAL).map((doc) => ({ doc }));
}
type Props = { params: Promise<{ doc: string }> };
const LEGAL_DESC: Record<string, string> = {
  privacy: "How Elans collects, uses, stores and protects personal data under Kenya's Data Protection Act, and how to exercise your rights.",
  terms: "The terms that apply when you use the Elans website and services.",
  cookies: "Which cookies the Elans website uses, why, and how to change your choices.",
  dpa: "The data processing agreement that governs how Elans handles personal data on behalf of its clients.",
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  const d = LEGAL[doc];
  return d ? { title: d.title, description: `${LEGAL_DESC[doc] ?? `${d.title} for Elans.`} Last updated ${d.updated}.`, alternates: { canonical: `/legal/${doc}` } } : {};
}

export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  const d = LEGAL[doc];
  if (!d) notFound();
  const { settings } = await getCatalogue();
  const body = d.body
    .replaceAll("{{ENTITY}}", settings.legalEntity ?? "Elans (legal entity name to be confirmed)")
    .replaceAll("{{ODPC}}", settings.odpcRegistration ?? "[registration pending]")
    .replaceAll("{{EMAIL}}", settings.email ?? "the contact form at /contact");
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Legal" }, { label: d.title }]} title={d.title} lead={`Last updated ${d.updated}`} />
      <Section className="pt-10">
        <Container className="max-w-3xl">
          <Callout tone="warning" title="Draft for legal review">
            This document is a working draft prepared before launch. It will be reviewed by a Kenyan lawyer before Elans processes client data in production.
          </Callout>
          <div className="mt-8">
            <Markdown source={body} />
          </div>
        </Container>
      </Section>
    </>
  );
}
