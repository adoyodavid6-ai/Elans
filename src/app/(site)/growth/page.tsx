import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { ButtonLink, Container, Eyebrow, Section, cx } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/Status";
import { PageHeader } from "@/components/site/PageHeader";
import { priceLabel, IndicativeTag } from "@/components/site/Price";
import { FinalCta } from "@/components/site/FinalCta";
import { Icon } from "@/components/ui/Icon";

export const revalidate = 60;
export const metadata: Metadata = { title: "Growth & marketing", description: "Elans Grow, Studio, Relate and Intelligence: growth strategy on the MADA Growth Engine™, AI visibility (GEO), SEO, paid media, social, email and WhatsApp marketing, AI content production and relationship intelligence.", alternates: { canonical: "/growth" } };

export default async function GrowthPage() {
  const cat = await getCatalogue();
  const byDiv = (d: string) => cat.growthServices.filter((g) => g.division === d);
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { label: "Growth & Marketing" }]}
        eyebrow="Elans Grow · Studio · Relate · Intelligence"
        title="Growth marketing with an automation engine underneath"
        lead="Strategy, campaigns, content, AI-search visibility and customer relationships, run by the same team that automates your operations. Every lead is answered in seconds, so marketing spend is not wasted."
        actions={
          <>
            <ButtonLink href="/growth/ai-visibility-check" icon="arrow-right">
              Run the free AI Visibility Check
            </ButtonLink>
            <ButtonLink href="/assessment" variant="secondary">
              Assess growth opportunities
            </ButtonLink>
          </>
        }
      />
      <Section className="pt-12">
        <Container className="space-y-14">
          {(["grow", "studio", "relate", "intelligence"] as const).map((d) => {
            const div = cat.divisions.find((x) => x.key === d)!;
            return (
              <section key={d} aria-labelledby={`div-${d}`} className="grid gap-6 lg:grid-cols-[1fr_2fr]">
                <div>
                  <Eyebrow>{div.tagline}</Eyebrow>
                  <h2 id={`div-${d}`} className="mt-2 font-display text-3xl font-semibold">
                    {div.name}
                  </h2>
                  <p className="mt-3 text-muted">{div.description}</p>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {byDiv(d).map((g) => (
                    <li key={g.slug} className="relative rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:shadow-[var(--shadow-soft)]">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-heading">
                          <Link href={`/growth/${g.slug}`} className="after:absolute after:inset-0 hover:underline">
                            {g.name}
                          </Link>
                        </h3>
                        <StatusBadge status={g.status} className="shrink-0" />
                      </div>
                      <p className="mt-2 text-sm text-muted">{g.summary}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </Container>
      </Section>
      <Section tone="sand" labelledBy="retainers-h">
        <Container>
          <Eyebrow>Marketing retainers</Eyebrow>
          <h2 id="retainers-h" className="mt-2 font-display text-3xl font-semibold">
            Three ways to grow with us
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {cat.growTiers.map((t, i) => {
              const p = priceLabel(cat, t.priceKey);
              return (
                <li key={t.key} className={cx("flex flex-col rounded-[var(--radius-card)] p-6 ring-1", i === 1 ? "surface-brand text-sand ring-brown" : "bg-white ring-line")}>
                  <p className={cx("font-display text-2xl font-semibold", i === 1 ? "text-ivory" : "text-heading")}>{t.name}</p>
                  <p className={cx("text-sm", i === 1 ? "text-sand/75" : "text-muted")}>{t.forWho}</p>
                  <p className={cx("mt-4 font-semibold", i === 1 ? "text-ivory" : "text-heading")}>
                    From {p.text}/month {!p.confirmed && <IndicativeTag />}
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {t.includes.map((x) => (
                      <li key={x} className="flex gap-2">
                        <Icon name="check" size={16} className="mt-0.5 shrink-0 text-copper" /> {x}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink href={`/contact?topic=grow&tier=${t.key}`} variant={i === 1 ? "light" : "secondary"} className="mt-6">
                    Discuss {t.name}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted">Ad spend and messaging costs are billed separately and transparently. No percentage-of-spend fees.</p>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
