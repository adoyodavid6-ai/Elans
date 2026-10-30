import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { Container, Section, Eyebrow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/site/PageHeader";
import { ContactForm } from "@/components/forms/ContactForm";

export const metadata: Metadata = { title: "Contact", description: "Contact Elans about AI automation, AI agents, growth marketing, quotations or partnerships. Nairobi, Kenya.", alternates: { canonical: "/contact" } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Contact({ searchParams }: Props) {
  const sp = await searchParams;
  const cat = await getCatalogue();
  const solution = sp.solution && cat.solutions.find((s) => s.slug === sp.solution)?.name;
  const pack = sp.pack && cat.packs.find((p) => p.slug === sp.pack)?.name;
  const pkg = sp.package && cat.packages.find((p) => p.key === sp.package)?.name;
  const tier = sp.tier && cat.growTiers.find((t) => t.key === sp.tier)?.name;
  const service = sp.service && cat.growthServices.find((g) => g.slug === sp.service)?.name;
  const template = sp.template && cat.templates.find((t) => t.slug === sp.template)?.name;
  const context = [solution, pack, pkg, tier && `Grow ${tier}`, service, template].filter(Boolean).join(" · ");
  const topic = sp.topic === "pricing" ? "quote" : sp.topic ?? "general";
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Contact" }]} eyebrow="Contact" title={topic === "quote" ? "Request a quotation" : "Talk to Elans"} lead="Tell us a little about your business. A consultant (a person, not a bot) will reply within one business day." />
      <Section className="pt-10">
        <Container className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
            <ContactForm topic={topic} context={context} />
          </div>
          <aside className="space-y-4">
            {[
              ["spark", "Not sure what you need?", "The free assessment scores your opportunities in 10 minutes.", "/assessment", "Start the assessment"],
              ["calendar", "Prefer to talk?", "Book a paid Strategy Session or a short Discovery Call.", "/sessions", "Book a session"],
              ["chat", "Quick question?", "Use the chat in the corner. It hands over to a person during support hours.", "#chat", "Open chat"],
            ].map(([icon, t, b, href, cta]) => (
              <div key={t} className="rounded-2xl border border-line bg-white p-5">
                <Icon name={icon} className="text-brown" />
                <p className="mt-2 font-semibold text-heading">{t}</p>
                <p className="mt-1 text-sm text-muted">{b}</p>
                <Link href={href} className="mt-2 inline-block text-sm font-semibold text-copper-ink hover:underline">{cta} →</Link>
              </div>
            ))}
            <div className="rounded-2xl bg-teal-50 p-5 text-sm">
              <Eyebrow>Office</Eyebrow>
              <p className="mt-2">{cat.settings.address}</p>
              {cat.settings.email && <p>{cat.settings.email}</p>}
              {cat.settings.phone && <p>{cat.settings.phone}</p>}
              <p className="mt-2 text-muted">Support hours: {cat.settings.supportHours}</p>
            </div>
          </aside>
        </Container>
      </Section>
    </>
  );
}
