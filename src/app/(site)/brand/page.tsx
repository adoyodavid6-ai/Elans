import type { Metadata } from "next";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/manrope";
import { Container, Eyebrow, Section, Callout } from "@/components/ui/primitives";
import { TreeMark, type LogoConcept } from "@/components/ui/Logo";
import { PageHeader } from "@/components/site/PageHeader";
import { StatusBadge, IntegrationBadge, IllustrativeTag } from "@/components/ui/Status";
import { Button } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Brand & design system", robots: { index: false, follow: false } };

const COLOURS = [
  ["--espresso", "#2B0012", "Deepest wine: headings, dark sections"],
  ["--brown", "#6A012A", "Brand wine: primary buttons, key panels"],
  ["--copper", "#C25B80", "Rose accent: large text and UI only (4.0:1 on #FCFCFC)"],
  ["--copper-ink", "#8C1D47", "Small accent text and links (8.6:1)"],
  ["--ivory", "#FCFCFC", "Page background"],
  ["--sand", "#F6ECF0", "Wine tint: panels, soft sections"],
  ["--graphite", "#242424", "Body text"],
];
const CONCEPTS: [LogoConcept, string, string][] = [
  ["a", "A · Rooted canopy", "A full canopy over a trunk and visible roots. Warm and recognisable at favicon size. Current default."],
  ["b", "B · Branching nodes", "A trunk branching into connected nodes: systems that grow. More technical and enterprise-leaning."],
  ["c", "C · Monogram tree", "An E whose arms are branches. Most distinctive as a wordmark partner; slightly less legible at 16 px."],
];

export default function Brand() {
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Brand" }]} eyebrow="Stage 1 · for David's decision" title="Brand & design system" lead="Three logo concepts, two typography pairings, colour tokens and core components. This page is not indexed." />
      <Section className="pt-10">
        <Container className="space-y-16">
          <section>
            <Eyebrow>Logo concepts: the growing brown tree</Eyebrow>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {CONCEPTS.map(([k, name, desc]) => (
                <div key={k} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                  <div className="flex items-end gap-5">
                    <TreeMark concept={k} size={96} title={name} />
                    <TreeMark concept={k} size={32} />
                    <TreeMark concept={k} size={16} />
                  </div>
                  <div className="mt-5 flex items-center gap-2.5">
                    <TreeMark concept={k} size={32} />
                    <span className="font-display text-2xl font-semibold text-espresso">Elans</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-espresso p-3">
                    <TreeMark concept={k} size={28} />
                    <span className="font-display text-xl font-semibold text-ivory">Elans</span>
                  </div>
                  <p className="mt-4 font-semibold text-heading">{name}</p>
                  <p className="mt-1 text-sm text-muted">{desc}</p>
                </div>
              ))}
            </div>
            <Callout tone="info" className="mt-6">Concepts are original drawings created for Elans. A trademark search is recommended before final selection.</Callout>
          </section>

          <section>
            <Eyebrow>Typography pairings</Eyebrow>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-copper-ink">Pairing 1 (current): Fraunces + Inter</p>
                <p className="mt-4 font-display text-4xl font-semibold text-espresso">Intelligent Systems. Measurable Results.</p>
                <p className="mt-3 font-sans text-[1.05rem] leading-relaxed">Elans finds where your business leaks time, cash and customers, and builds the systems to fix it. Inter is highly legible on low-end Android screens.</p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-copper-ink">Pairing 2: Newsreader + Manrope</p>
                <p className="mt-4 text-4xl font-semibold text-espresso" style={{ fontFamily: "var(--font-alt-display)" }}>Intelligent Systems. Measurable Results.</p>
                <p className="mt-3 text-[1.05rem] leading-relaxed" style={{ fontFamily: "var(--font-alt-sans)" }}>Elans finds where your business leaks time, cash and customers, and builds the systems to fix it. Manrope gives a slightly more geometric, technical feel.</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">All four typefaces are open-source (SIL Open Font Licence) and self-hosted, so there are no licence fees and no third-party font requests.</p>
          </section>

          <section>
            <Eyebrow>Colour tokens</Eyebrow>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {COLOURS.map(([t, hex, use]) => (
                <li key={t} className="overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="h-20" style={{ background: hex }} />
                  <div className="p-3 text-sm">
                    <p className="font-mono text-xs">{t} · {hex}</p>
                    <p className="mt-1 text-muted">{use}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <Eyebrow>Components</Eyebrow>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <StatusBadge status="live" />
              <StatusBadge status="pilot" />
              <StatusBadge status="planned" />
              <StatusBadge status="custom" />
              <IntegrationBadge status="supported" />
              <IntegrationBadge status="planned" />
              <IntegrationBadge status="custom_assessment" />
              <IllustrativeTag />
            </div>
          </section>
        </Container>
      </Section>
    </>
  );
}
