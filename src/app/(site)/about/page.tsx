import type { Metadata } from "next";
import { getCatalogue } from "@/lib/content";
import { CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";
import { TreeMark } from "@/components/ui/Logo";

export const revalidate = 300;
export const metadata: Metadata = { title: "About Elans", description: "Elans is an AI automation and growth company launching in Nairobi, Kenya, serving East Africa and international clients. We find operational and growth gaps and build accountable systems to close them.", alternates: { canonical: "/about" } };

export default async function About() {
  const cat = await getCatalogue();
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "About" }]} eyebrow="About Elans" title="We find the gaps. We build the intelligence to close them." lead={cat.settings.marketScope} />
      <Section className="pt-12">
        <Container className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div className="prose-elans max-w-none text-[1.05rem]">
            <p><strong>Elans is an AI automation and growth company.</strong> We find where a business leaks time, cash and customers, build intelligent automation and marketing systems to close those leaks, and keep them running against measurable improvements in productivity, accuracy, customer experience and revenue.</p>
            <h2>Why we exist</h2>
            <p>Large enterprises are adopting AI far faster than the small and mid-sized businesses that employ most people. The barriers are real: cost, skills, complexity and uncertainty about data protection. Self-serve tools do not solve that. A team that designs, builds, proves and runs the system does.</p>
            <h2>How we are different</h2>
            <ul>
              <li><strong>Accountable, not just clever.</strong> One owner metric per automation, a measured baseline and a named engineer.</li>
              <li><strong>Kenya-first depth.</strong> eTIMS, M-Pesa, SHA claims, bilingual customers and WhatsApp-first commerce are our starting point.</li>
              <li><strong>Automation and growth together.</strong> The same platform that answers customers also runs campaigns, content and AI-search visibility.</li>
              <li><strong>Honest by design.</strong> Every solution shows its real status. Illustrative examples are labelled. We claim no certification we do not hold.</li>
            </ul>
            <h2>Our name and mark</h2>
            <p>Elans grows from LassElans and La Mada, earlier ventures in operations agents and growth marketing. Our mark is a growing tree: the roots are the systems, the trunk is the platform and the canopy is your growth.</p>
          </div>
          <aside className="space-y-6">
            <div className="flex items-center gap-4 rounded-[var(--radius-card)] surface-brand p-6 text-sand">
              <TreeMark size={64} onBrand />
              <div>
                <p className="font-display text-2xl font-semibold text-ivory">Elans</p>
                <p className="text-sm text-sand/80">{cat.settings.tagline}</p>
              </div>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <Eyebrow>Seven divisions, one platform</Eyebrow>
              <ul className="mt-4 space-y-3">
                {cat.divisions.map((d) => (
                  <li key={d.key}>
                    <p className="font-semibold text-heading">{d.name}</p>
                    <p className="text-sm text-muted">{d.tagline}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <Eyebrow>Company details</Eyebrow>
              <CheckList className="mt-3 text-sm" items={[`Based in ${cat.settings.address}`, cat.settings.legalEntity ? `Legal entity: ${cat.settings.legalEntity}` : "Legal entity details published on registration", "Prices in KES by default; international quotes in your currency"]} />
            </div>
          </aside>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
