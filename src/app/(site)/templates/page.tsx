import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/content";
import { Container, Section, Pill } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";

export const revalidate = 60;
export const metadata: Metadata = { title: "Automation template library", description: "Reusable, versioned automation templates behind Elans solutions, with prerequisites, integrations, setup time and maintenance status.", alternates: { canonical: "/templates" } };

const MAINT = { active: "Active", beta: "Beta", planned: "Planned" } as const;

export default async function TemplatesPage() {
  const cat = await getCatalogue();
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Templates" }]} eyebrow="Template library" title="Proven patterns, configured for you" lead="Every Elans solution is built from versioned templates. Templates still need configuration to your data and approvals. Nothing here is instant self-service, and we will never pretend otherwise." />
      <Section className="pt-12">
        <Container>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Function</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Complexity</th>
                  <th className="px-4 py-3">Setup</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Maintenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {cat.templates.map((t) => (
                  <tr key={t.slug} className="hover:bg-ivory">
                    <td className="px-4 py-3">
                      <Link href={`/templates/${t.slug}`} className="font-semibold text-heading hover:underline">
                        {t.name}
                      </Link>
                      <p className="text-xs text-muted">{t.problem}</p>
                    </td>
                    <td className="px-4 py-3">{cat.categories.find((c) => c.slug === t.fn)?.name}</td>
                    <td className="px-4 py-3">{t.industry === "cross-industry" ? "Cross-industry" : cat.industries.find((i) => i.slug === t.industry)?.short}</td>
                    <td className="px-4 py-3 capitalize">{t.complexity}</td>
                    <td className="px-4 py-3">{t.setupTime}</td>
                    <td className="px-4 py-3 font-mono text-xs">v{t.version}</td>
                    <td className="px-4 py-3">
                      <Pill tone={t.maintenance === "active" ? "copper" : "sand"}>{MAINT[t.maintenance]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
