import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { ButtonLink, Callout, Container, Eyebrow, Faqs, Section, cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/site/PageHeader";
import { priceLabel, IndicativeTag } from "@/components/site/Price";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export const metadata: Metadata = { title: "Pricing", description: "Published starting prices for Elans automation packages (Launch, Growth, Scale, Enterprise), marketing retainers and paid strategy sessions. Retainer plus usage, fixed scope, KES by default.", alternates: { canonical: "/pricing" } };

export default async function PricingPage() {
  const cat = await getCatalogue();
  const unconfirmed = cat.pricePoints.some((p) => !p.confirmed && p.amount !== null);
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Pricing" }]} eyebrow="Pricing & engagement models" title="Clear starting prices. Fixed scope. Accountable results." lead="Setup fee plus a monthly run retainer, with usage allowances. Every quote is fixed-scope; anything new is priced as a change order before work starts." />
      <Section className="pt-10">
        <Container>
          {unconfirmed && (
            <Callout tone="neutral" className="mb-8" title="About these prices">
              Prices marked Indicative are our suggested starting points and may change before launch. Your written quotation is always the final price. All prices exclude VAT.
            </Callout>
          )}
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cat.packages.map((p, i) => {
              const s = priceLabel(cat, p.setupKey);
              const m = priceLabel(cat, p.monthlyKey);
              return (
                <li key={p.key} className={cx("flex flex-col rounded-[var(--radius-card)] p-6 ring-1", i === 1 ? "surface-brand text-sand ring-brown" : "bg-white ring-line")}>
                  {i === 1 && <span className="mb-3 self-start rounded-full bg-copper px-2.5 py-0.5 text-xs font-semibold text-espresso">Most common</span>}
                  <h2 className={cx("font-display text-2xl font-bold", i === 1 ? "text-ivory" : "text-heading")}>{p.name}</h2>
                  <p className={cx("mt-1 text-sm", i === 1 ? "text-sand/75" : "text-muted")}>{p.forWho}</p>
                  <div className="mt-5">
                    {p.key === "enterprise" ? (
                      <p className={cx("font-display text-3xl font-bold", i === 1 ? "text-ivory" : "text-heading")}>Quoted</p>
                    ) : (
                      <>
                        <p className={cx("text-xs uppercase tracking-wide", i === 1 ? "text-sand/70" : "text-muted")}>Setup from</p>
                        <p className={cx("font-display text-3xl font-bold", i === 1 ? "text-ivory" : "text-heading")}>
                          {s.text} {!s.confirmed && <IndicativeTag />}
                        </p>
                        <p className={cx("mt-1 text-sm", i === 1 ? "text-sand/80" : "text-muted")}>
                          then from <span className="font-semibold">{m.text}</span>/month{p.key === "scale" ? " + usage" : ""}
                        </p>
                      </>
                    )}
                  </div>
                  <p className={cx("mt-4 text-sm", i === 1 ? "text-sand/85" : "text-text")}>{p.summary}</p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {p.scope.map((x) => (
                      <li key={x} className="flex gap-2">
                        <Icon name="check" size={16} className="mt-0.5 shrink-0 text-copper" /> {x}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-col gap-2">
                    <ButtonLink href={`/contact?topic=quote&package=${p.key}`} variant={i === 1 ? "light" : "primary"}>
                      Request a quote
                    </ButtonLink>
                    <Link href={`/pricing/${p.key}`} className={cx("text-center text-sm font-semibold hover:underline", i === 1 ? "text-copper" : "text-copper-ink")}>
                      Full package details
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <Section tone="sand" labelledBy="other-h">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Sessions & diagnostics</Eyebrow>
            <h2 id="other-h" className="mt-2 font-display text-3xl font-bold">Human-led work is paid, and worth it</h2>
            <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
              {[
                ["session.discovery", "Short qualification call to see whether we can help."],
                ["session.strategy", "60–90 minutes with an Elans consultant: your processes, priorities and a written action list. Booked and paid online."],
                ["diagnostic", "Baseline measurement, scored opportunities and a fixed-scope quote. Fully credited if you go ahead with a build."],
                ["session.support", "Extra Client Support Sessions beyond your package allowance."],
              ].map(([key, d]) => {
                const p = cat.pricePoints.find((x) => x.key === key)!;
                const l = priceLabel(cat, key);
                return (
                  <li key={key} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-heading">{p.label}</p>
                      <p className="text-sm text-muted">{d}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-heading">
                      {p.amount === 0 ? "Free" : l.text} {!l.confirmed && p.amount !== 0 && <IndicativeTag />}
                    </p>
                  </li>
                );
              })}
            </ul>
            <ButtonLink href="/sessions" className="mt-5" icon="arrow-right">
              Book a session
            </ButtonLink>
          </div>
          <div>
            <Eyebrow>Revenue model, openly</Eyebrow>
            <h2 className="mt-2 font-display text-3xl font-bold">How you pay us</h2>
            <ul className="mt-6 space-y-3 text-[0.95rem]">
              {[
                ["Setup fee", "Fixed price for the agreed scope; can be split over three months."],
                ["Run retainer", "Monthly fee for monitoring, maintenance, support and reporting."],
                ["Usage", "Voice minutes, WhatsApp conversations, document pages and AI tokens: included allowance, then published unit rates."],
                ["Per resolved conversation (Converse option)", "Pay only when the agent closes a customer request without a person taking over, and the customer does not come back about it within 72 hours."],
                ["Outcome fees (selective)", "Only where a clean baseline was agreed in the Diagnostic."],
                ["Grow & Studio retainers", "Fixed monthly retainers; ad spend billed separately at cost."],
              ].map(([t, d]) => (
                <li key={t} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                  <p className="font-semibold text-heading">{t}</p>
                  <p className="text-sm text-muted">{d}</p>
                </li>
              ))}
            </ul>
            <Link href="/growth#retainers-h" className="mt-4 inline-block text-sm font-semibold text-copper-ink hover:underline">
              Marketing retainer tiers →
            </Link>
          </div>
        </Container>
      </Section>

      <Section labelledBy="pfaq">
        <Container className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <h2 id="pfaq" className="font-display text-3xl font-bold">Pricing questions</h2>
          <Faqs
            items={[
              { q: "Is there a minimum term?", a: `Yes: ${cat.settings.minTermMonths} months for run retainers, because the first months include the supervised Prove period. Discounts are available only for longer terms.` },
              { q: "Why not the cheapest option?", a: "We price for accountability: a measured baseline, supervision, monitoring and a named engineer. Cheap automation that nobody maintains usually stops working." },
              { q: "What is not included?", a: "Third-party licences and messaging fees unless stated, bespoke integrations beyond the agreed scope, and data clean-up beyond the baseline sample. Every package page lists its exclusions." },
              { q: "Can I pay by M-Pesa?", a: "Yes. Strategy Sessions can be paid online by M-Pesa or card, and invoices can be paid by M-Pesa, card or bank transfer." },
              { q: "Do prices differ outside Kenya?", a: "Prices are shown in KES by default and quoted in your currency where appropriate." },
            ]}
          />
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
