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
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  const d = LEGAL[doc];
  return d ? { title: d.title, alternates: { canonical: `/legal/${doc}` } } : {};
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
