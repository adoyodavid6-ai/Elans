import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { ButtonLink, Card, Container, Eyebrow, Faqs, Heading, Lead, Section, TextLink, CheckList, cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { IntegrationBadge, StatusBadge, IllustrativeTag } from "@/components/ui/Status";
import { PackageFrom, priceLabel } from "@/components/site/Price";
import { MiniAssessment, type MiniOption } from "@/components/site/home/MiniAssessment";
import { DemoTabs } from "@/components/site/home/DemoTabs";
import { MiniRoi } from "@/components/site/home/MiniRoi";
import { method } from "@/content/seed/method";
import { JsonLd, organisationLd } from "@/components/site/JsonLd";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;

const PAIN_MAP: Record<string, string[]> = {
  messages: ["whatsapp-sales-support-agent", "ai-voice-receptionist", "web-chat-agent", "instant-lead-response", "restaurant-booking-agent", "parent-helpdesk", "tenant-helpdesk", "order-status-agent"],
  payments: ["mpesa-bank-reconciliation", "payment-confirmation-agent", "school-fee-collection", "rent-collection", "auto-receipting"],
  tax: ["etims-compliance-reconciliation", "statutory-deadline-guardian", "pre-filing-variance-report", "dpa-operations", "supplier-onboarding-compliance"],
  arrears: ["collections-receivables", "school-fee-collection", "rent-collection", "sha-claims-scrubber", "dunning-escalation-ladder", "failed-payment-recovery"],
  documents: ["document-extraction", "ap-invoice-capture", "sha-claims-scrubber", "delivery-note-capture", "claims-document-intake", "kyc-document-checks"],
  growth: ["instant-lead-response", "ai-readable-product-data", "win-back-retention", "review-requests", "whatsapp-commerce"],
};

const PROBLEMS = [
  { icon: "chat", title: "Enquiries go cold after hours", body: "Customers message on WhatsApp in the evening and buy from whoever answers first.", href: "/solutions/customer-service/whatsapp-sales-support-agent" },
  { icon: "money", title: "Hours lost matching M-Pesa payments", body: "Wrong account numbers and split payments turn reconciliation into detective work.", href: "/solutions/payments-reconciliation/mpesa-bank-reconciliation" },
  { icon: "shield", title: "Expenses without eTIMS support", body: "KRA now validates expenses against eTIMS data. Gaps found at filing time are expensive.", href: "/solutions/tax-compliance/etims-compliance-reconciliation" },
  { icon: "doc", title: "Claims returned for paperwork", body: "Missing signatures and inconsistent details delay hospital cash by weeks.", href: "/solutions/healthcare-admin/sha-claims-scrubber" },
  { icon: "clock", title: "Arrears chased inconsistently", body: "Some customers are called daily, others forgotten, and promises to pay are lost.", href: "/solutions/collections-credit/collections-receivables" },
  { icon: "eye", title: "Invisible in AI answers", body: "Customers now ask AI assistants for recommendations. Are you in the answer?", href: "/growth/ai-visibility-geo" },
];

export default async function Home() {
  const cat = await getCatalogue();
  const featured = cat.solutions.filter((s) => s.featured).sort((a, b) => (a.gapRank ?? 99) - (b.gapRank ?? 99));
  const catOf = (slug: string) => cat.solutions.find((s) => s.slug === slug)?.category;
  const miniOptions: MiniOption[] = Object.entries(PAIN_MAP).flatMap(([pain, slugs]) =>
    slugs
      .map((slug) => cat.solutions.find((s) => s.slug === slug))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({ slug: s.slug, name: s.name, summary: s.summary, href: `/solutions/${s.category}/${s.slug}`, status: s.status, industries: s.industries, pains: [pain] })),
  );
  const mergedOptions = Object.values(
    miniOptions.reduce<Record<string, MiniOption>>((acc, o) => {
      acc[o.slug] = acc[o.slug] ? { ...acc[o.slug], pains: [...acc[o.slug].pains, ...o.pains] } : o;
      return acc;
    }, {}),
  );
  const launchSetup = priceLabel(cat, "launch.setup").amount ?? 120000;
  const launchMonthly = priceLabel(cat, "launch.monthly").amount ?? 20000;
  const supported = cat.integrations.filter((i) => i.status === "supported");
  const keyIntegrations = ["whatsapp-business", "mpesa-daraja", "etims", "quickbooks", "xero", "microsoft-365", "google-workspace", "shopify", "hmis", "core-banking"]
    .map((s) => cat.integrations.find((i) => i.slug === s))
    .filter(Boolean) as typeof cat.integrations;

  const faqs = [
    { q: "What does Elans actually do?", a: "We find the operational and growth gaps in your business, build AI automation and marketing systems to close them, and then run those systems for you, reporting monthly against a metric you agree with us." },
    { q: "Is the assessment really free?", a: "Yes. The self-serve AI Opportunity Assessment is automated and free. Human-led work (Strategy Sessions and the Automation Diagnostic) is paid, and the Diagnostic fee is credited against your build." },
    { q: "Will AI make decisions about my customers' money?", a: "No. Money, tax and statutory calculations run as deterministic code. AI reads documents and understands language. Anything irreversible, financial or customer-facing goes through an approval gate unless you explicitly switch on autonomy for that action." },
    { q: "Do you have client case studies?", a: `Not yet. We are a new company and we will not invent them. Our examples are clearly labelled as illustrative${cat.settings.caseStudyDate ? `, and first client results will be published from ${cat.settings.caseStudyDate}` : ""}.` },
    { q: "Do you work outside Kenya?", a: "Yes. We launch in Kenya and serve East Africa and international clients. Currency, tax regime, language and data region are configuration, not code." },
    { q: "What happens if an automation goes wrong?", a: "Every automation has monitoring, alerts, an audit trail, compensating actions where possible and a kill switch you control. A named Elans engineer is accountable for each one." },
    { q: "Do you use our data to train AI?", a: "No. Client data is never used to train models, and personal data is redacted before model calls where possible." },
  ];

  return (
    <>
      <JsonLd data={organisationLd(cat.settings)} />

      {/* 1 Hero */}
      <section className="rule-blend relative overflow-hidden border-b bg-ivory">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-sand/70 blur-3xl" />
        <Container wide className="relative grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
          <div>
            <Eyebrow>Elans — AI Automation & Growth</Eyebrow>
            <Heading as="h1" size="xl" className="mt-4">
              Your Business Has Gaps. We Build the Intelligence to Close Them.
            </Heading>
            <Lead className="mt-6 max-w-xl">
              Elans finds where your business leaks time, cash and customers, builds the automation and marketing systems to fix it, and keeps them running against results you can measure.
            </Lead>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/assessment" size="lg" icon="arrow-right">
                Find Your Automation Opportunities
              </ButtonLink>
              <ButtonLink href="/sessions" variant="secondary" size="lg">
                Book a Strategy Session
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["Free 10-minute assessment", "Published starting prices", "Human approval on what matters", "Kenya-first, built for global"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Icon name="check" size={16} className="text-brown" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </Container>
      </section>

      {/* 2 Problems */}
      <Section labelledBy="problems-h">
        <Container>
          <div className="max-w-2xl">
            <Eyebrow>Problems we solve</Eyebrow>
            <Heading id="problems-h" className="mt-3">
              The leaks that cost growing businesses every week
            </Heading>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEMS.map((p) => (
              <li key={p.title}>
                <Link href={p.href} className="group block h-full rounded-[var(--radius-card)] border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sand text-brown">
                    <Icon name={p.icon} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-heading">{p.title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{p.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-copper-ink group-hover:underline">
                    How we fix it <Icon name="arrow-right" size={15} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 3 Featured solutions */}
      <Section tone="sand" labelledBy="featured-h">
        <Container>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <Eyebrow>Featured solutions</Eyebrow>
              <Heading id="featured-h" className="mt-3">
                Where Kenyan businesses get the fastest return
              </Heading>
              <p className="mt-3 text-muted">Ranked by the Elans Opportunity Score. Every solution shows its real status.</p>
            </div>
            <TextLink href="/solutions">Browse all {cat.solutions.length} solutions</TextLink>
          </div>
          <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <li key={s.slug}>
                <Card interactive className="relative flex h-full flex-col bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-copper-ink">{cat.divisions.find((d) => d.key === s.division)?.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-heading">
                    <Link href={`/solutions/${s.category}/${s.slug}`} className="after:absolute after:inset-0 hover:underline">
                      {s.name}
                    </Link>
                  </h3>
                  <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-muted">{s.summary}</p>
                  <div className="rule-blend-soft mt-5 border-t pt-4">
                    <PackageFrom cat={cat} pkg={s.pricing.package} compact />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 4 Growth engine */}
      <Section labelledBy="growth-h">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
            <div>
              <Eyebrow>Growth & marketing engine</Eyebrow>
              <Heading id="growth-h" className="mt-3">
                Automation and marketing, one accountable team
              </Heading>
              <p className="mt-4 text-muted">
                The same platform that answers your customers and reconciles your payments also runs your growth: campaigns, content, AI-search visibility and relationships. Leads are answered in seconds, so marketing spend is not wasted.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/growth" variant="secondary">
                  Explore Growth & Marketing
                </ButtonLink>
                <ButtonLink href="/growth/ai-visibility-check" variant="ghost" icon="arrow-right">
                  Free AI Visibility Check
                </ButtonLink>
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {cat.divisions
                .filter((d) => ["grow", "studio", "relate", "intelligence"].includes(d.key))
                .map((d) => (
                  <li key={d.key} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                    <p className="font-display text-xl font-semibold text-heading">{d.name}</p>
                    <p className="mt-1 text-sm font-medium text-copper-ink">{d.tagline}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{d.description}</p>
                  </li>
                ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* 5 Industry pathways */}
      <Section tone="dark" labelledBy="industries-h">
        <Container>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <Eyebrow tone="light">Industry pathways</Eyebrow>
              <Heading id="industries-h" className="mt-3 text-ivory">
                Built around how your sector actually works
              </Heading>
            </div>
            <Link href="/industries" className="inline-flex items-center gap-1.5 font-semibold text-copper hover:underline">
              All {cat.industries.length} industries <Icon name="arrow-right" size={16} />
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cat.industries.slice(0, 12).map((i) => (
              <li key={i.slug}>
                <Link href={`/industries/${i.slug}`} className="block h-full rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition hover:bg-white/10">
                  <p className="font-semibold text-ivory">{i.short}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-sand/75">{i.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 6 Interactive discovery */}
      <Section labelledBy="discover-h">
        <Container>
          <div className="max-w-2xl">
            <Eyebrow>Quick discovery</Eyebrow>
            <Heading id="discover-h" className="mt-3">
              See where you would start in 20 seconds
            </Heading>
          </div>
          <div className="mt-10">
            <MiniAssessment industries={cat.industries.map((i) => ({ slug: i.slug, short: i.short }))} options={mergedOptions} />
          </div>
        </Container>
      </Section>

      {/* 7 How it works */}
      <Section tone="teal" labelledBy="method-h">
        <Container>
          <div className="max-w-2xl">
            <Eyebrow>How Elans works</Eyebrow>
            <Heading id="method-h" className="mt-3">
              The Elans Method: prove one, then scale
            </Heading>
            <p className="mt-3 text-muted">Every engagement follows the same six stages, with a measured baseline before we build and a supervised Prove period before we call it done.</p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {method.map((m, i) => (
              <li key={m.key} className="relative rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-line">
                <span className="font-display text-3xl font-semibold text-copper">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-2 font-semibold text-heading">{m.name}</p>
                <p className="mt-0.5 text-xs font-medium text-copper-ink">{m.duration}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{m.summary}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <TextLink href="/how-it-works">Read the full method</TextLink>
          </div>
        </Container>
      </Section>

      {/* 8 Before/after */}
      <Section labelledBy="demo-h">
        <Container>
          <div className="max-w-2xl">
            <Eyebrow>Before and after</Eyebrow>
            <Heading id="demo-h" className="mt-3">
              What changes in the workflow
            </Heading>
            <p className="mt-3 text-muted">Rules handle money and compliance. AI handles reading and language. People approve what matters.</p>
          </div>
          <div className="mt-10">
            <DemoTabs examples={cat.examples} />
          </div>
        </Container>
      </Section>

      {/* 9 ROI estimator */}
      <Section labelledBy="roi-h" className="pt-0 sm:pt-0">
        <Container>
          <div className="mb-8 max-w-2xl">
            <Eyebrow>ROI estimator</Eyebrow>
            <Heading id="roi-h" className="mt-3">
              Estimate the value before you spend anything
            </Heading>
            <p className="mt-3 text-muted">We separate time freed (labour capacity) from cash savings, and show every formula.</p>
          </div>
          <MiniRoi setup={launchSetup} monthly={launchMonthly} />
        </Container>
      </Section>

      {/* 10 Managed automation */}
      <Section tone="sand" labelledBy="managed-h">
        <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Managed automation & ongoing support</Eyebrow>
            <Heading id="managed-h" className="mt-3">
              We do not hand over a bot and disappear
            </Heading>
            <p className="mt-4 text-muted">
              Many AI projects stall after the demo: costs creep, the value is never measured and nobody owns the risks. Elans is built the other way round. Every automation is run, measured and maintained by us.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["target", "One owner metric", "Agreed with you, with a measured baseline before go-live."],
              ["eye", "Supervised Prove period", "Closer human review until the numbers say it is ready."],
              ["chart", "Monthly report", "Results against baseline, incidents, costs and next steps."],
              ["user", "Named accountable engineer", "A person, not a ticket queue, owns your automation."],
              ["power", "Kill switch", "Pause any automation instantly from your portal."],
              ["doc", "Full audit trail", "Inputs, outputs, model, prompt version and reviewer for every step."],
            ].map(([icon, t, b]) => (
              <div key={t} className="rounded-2xl bg-white p-5 ring-1 ring-line">
                <Icon name={icon} className="text-brown" />
                <p className="mt-2 font-semibold text-heading">{t}</p>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* 11 Integrations */}
      <Section labelledBy="integrations-h">
        <Container>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <Eyebrow>Integrations</Eyebrow>
              <Heading id="integrations-h" className="mt-3">
                Connected to the tools you already use, with honest status
              </Heading>
              <p className="mt-3 text-muted">
                {supported.length} supported today, {cat.integrations.filter((i) => i.status === "planned").length} planned and the rest by custom assessment. No implied partnerships or certifications.
              </p>
            </div>
            <TextLink href="/integrations">Integration directory</TextLink>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {keyIntegrations.map((i) => (
              <li key={i.slug} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3">
                <span className="text-sm font-medium text-heading">{i.name.replace(/ \(.*\)$/, "")}</span>
                <IntegrationBadge status={i.status} />
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 12 Security & governance */}
      <Section tone="dark" labelledBy="trust-h">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <Eyebrow tone="light">Security & AI governance</Eyebrow>
            <Heading id="trust-h" className="mt-3 text-ivory">
              Governance you can see, not badges you have to trust
            </Heading>
            <p className="mt-4 text-sand/80">We describe the controls we actually run. We claim no certification we have not obtained.</p>
            <ButtonLink href="/trust" variant="light" className="mt-6">
              How we protect your data
            </ButtonLink>
          </div>
          <CheckList
            tone="light"
            className="grid gap-3 text-sand/90 sm:grid-cols-2 [&>li]:rounded-2xl [&>li]:bg-white/5 [&>li]:p-4 [&>li]:ring-1 [&>li]:ring-white/10"
            items={[
              "Tenant isolation enforced in the database (row-level security), tested on every change",
              "Multi-factor authentication for staff and client administrators",
              "Client data never used to train AI models",
              "Approval gates for financial, filing and customer-facing actions",
              "Untrusted content never becomes instructions to an agent",
              "72-hour breach workflow and data-subject request tracking",
            ]}
          />
        </Container>
      </Section>

      {/* 13 Case studies / illustrative */}
      <Section labelledBy="cases-h">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <Eyebrow>Case studies</Eyebrow>
              <Heading id="cases-h" className="mt-3">
                Real results, published only when they are real
              </Heading>
              <p className="mt-4 text-muted">
                Elans is new. Rather than invent logos or savings, we show illustrative workflow examples, clearly labelled.{" "}
                {cat.settings.caseStudyDate ? `First client results publish from ${cat.settings.caseStudyDate}.` : "First client results will be published once measured against an agreed baseline."}
              </p>
              <TextLink href="/case-studies" className="mt-5">
                See illustrative examples
              </TextLink>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {cat.examples.map((e) => (
                <li key={e.slug} className="rounded-[var(--radius-card)] border border-dashed border-copper/50 bg-white p-5">
                  <IllustrativeTag />
                  <p className="mt-3 font-semibold text-heading">{e.title}</p>
                  <p className="mt-1 text-sm text-muted">{e.scenario}</p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* 14 Pricing */}
      <Section tone="teal" labelledBy="pricing-h">
        <Container>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <Eyebrow>Pricing & engagement models</Eyebrow>
              <Heading id="pricing-h" className="mt-3">
                Published starting prices. Fixed scope. No surprises.
              </Heading>
            </div>
            <TextLink href="/pricing">Full pricing</TextLink>
          </div>
          <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cat.packages.map((p, i) => (
              <li key={p.key} className={cx("flex flex-col rounded-[var(--radius-card)] p-6 ring-1", i === 1 ? "surface-brand text-sand ring-brown" : "bg-white ring-line")}>
                <p className={cx("font-display text-xl font-semibold", i === 1 ? "text-ivory" : "text-heading")}>{p.name}</p>
                <p className={cx("mt-1 text-sm", i === 1 ? "text-sand/80" : "text-muted")}>{p.forWho}</p>
                <div className="mt-5 flex-1">
                  {p.key === "enterprise" ? (
                    <p className={cx("font-semibold", i === 1 ? "text-ivory" : "text-heading")}>Quoted</p>
                  ) : (
                    <PackageFrom cat={cat} pkg={p.key} className={i === 1 ? "text-sand/80 [&_.text-heading]:text-ivory" : ""} />
                  )}
                </div>
                <Link href={`/pricing/${p.key}`} className={cx("mt-5 inline-flex items-center gap-1 text-sm font-semibold", i === 1 ? "text-copper" : "text-copper-ink")}>
                  What&apos;s included <Icon name="arrow-right" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 15 FAQs */}
      <Section labelledBy="faq-h">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow>FAQs</Eyebrow>
            <Heading id="faq-h" className="mt-3">
              Straight answers
            </Heading>
          </div>
          <Faqs items={faqs} />
        </Container>
        <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      </Section>

      {/* 16 Final CTA */}
      <FinalCta />
    </>
  );
}

function HeroVisual() {
  const inputs = [
    ["chat", "WhatsApp enquiry", "'Bei ya cement ni ngapi?'"],
    ["money", "M-Pesa payment", "Ref: 'fees form 2 wanjiku'"],
    ["doc", "Supplier invoice", "Photo, slightly blurred"],
    ["phone", "Missed call", "19:42, after hours"],
  ];
  const outputs = [
    ["check", "Quote sent in 40 s", "Priced from your list"],
    ["check", "Payment matched & receipted", "Confidence 0.96"],
    ["shield", "eTIMS check: needs review", "Sent to your reviewer"],
    ["calendar", "Callback booked", "WhatsApp confirmation sent"],
  ];
  return (
    <figure aria-label="Illustration: business inputs flow through Elans rules, AI and approvals to measurable outcomes" className="relative">
      <div className="rounded-[2rem] border border-line bg-white p-4 shadow-[var(--shadow-lift)] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Live workflow</p>
          <IllustrativeTag>Illustrative</IllustrativeTag>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <ul className="space-y-2">
            {inputs.map(([icon, t, s]) => (
              <li key={t} className="rounded-xl border border-line bg-ivory p-2.5 sm:p-3">
                <p className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-heading sm:text-sm">
                  <Icon name={icon} size={15} className="text-brown" /> {t}
                </p>
                <p className="mt-0.5 hidden truncate text-xs text-muted sm:block">{s}</p>
              </li>
            ))}
          </ul>
          <div className="relative flex flex-col items-center">
            <svg width="44" height="220" viewBox="0 0 44 220" aria-hidden className="absolute -left-3 hidden sm:block">
              {[20, 75, 130, 185].map((y) => (
                <path key={y} d={`M0 ${y} C 22 ${y}, 22 110, 44 110`} stroke="#B98258" strokeWidth="1.5" fill="none" className="flow-line" />
              ))}
            </svg>
            <div className="relative z-10 grid w-[5.5rem] gap-1.5 rounded-2xl surface-brand p-2.5 text-center sm:w-28 sm:p-3">
              <span className="text-[0.62rem] font-semibold uppercase tracking-widest text-copper">Elans</span>
              {["Rules", "AI", "Approvals"].map((x) => (
                <span key={x} className="rounded-lg bg-white/10 px-1 py-1 text-[0.7rem] font-medium text-ivory">
                  {x}
                </span>
              ))}
            </div>
          </div>
          <ul className="space-y-2">
            {outputs.map(([icon, t, s]) => (
              <li key={t} className="rounded-xl border border-success/20 bg-success-bg/60 p-2.5 sm:p-3">
                <p className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-heading sm:text-sm">
                  <Icon name={icon} size={15} className="text-success" /> {t}
                </p>
                <p className="mt-0.5 hidden truncate text-xs text-muted sm:block">{s}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rule-blend-soft mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center">
          {[
            ["Owner metric", "% receipts auto-matched"],
            ["Review queue", "3 items · SLA 4 h"],
            ["Kill switch", "Armed"],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-[0.65rem] uppercase tracking-wide text-muted">{l}</p>
              <p className="text-xs font-semibold text-heading">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
