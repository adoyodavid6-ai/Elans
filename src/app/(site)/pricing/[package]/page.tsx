import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/lib/content";
import { seed } from "@/content/seed";
import { ButtonLink, Card, CheckList, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { PackageFrom } from "@/components/site/Price";
import { FinalCta } from "@/components/site/FinalCta";
import { Icon } from "@/components/ui/Icon";

export const revalidate = 60;
export function generateStaticParams() {
  return seed.packages.map((p) => ({ package: p.key }));
}
type Props = { params: Promise<{ package: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { package: key } = await params;
  const p = (await getCatalogue()).packages.find((x) => x.key === key);
  return p ? { title: `${p.name} package`, description: p.summary } : {};
}

export default async function PackagePage({ params }: Props) {
  const { package: key } = await params;
  const cat = await getCatalogue();
  const p = cat.packages.find((x) => x.key === key);
  if (!p) notFound();
  const rows: [string, React.ReactNode][] = [
    ["Typical integrations", p.integrations],
    ["Support level", p.support],
    ["Monitoring", p.monitoring],
    ["Training", p.training],
    ["Change requests", p.changeRequests],
  ];
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { label: p.name }]}
        eyebrow={p.forWho}
        title={p.name}
        lead={p.summary}
        actions={<ButtonLink href={`/contact?topic=quote&package=${p.key}`} icon="arrow-right">Request a quote</ButtonLink>}
        aside={<Card><Eyebrow>Starting price</Eyebrow><div className="mt-2"><PackageFrom cat={cat} pkg={p.key} /></div></Card>}
      />
      <Section className="pt-12">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-8">
            <section>
              <Eyebrow>Scope</Eyebrow>
              <CheckList className="mt-3" items={p.scope} />
            </section>
            <section>
              <Eyebrow>Implementation process</Eyebrow>
              <ol className="mt-3 space-y-2">
                {p.process.map((s, i) => (
                  <li key={s} className="flex gap-3 rounded-xl border border-line bg-white p-3 text-sm">
                    <span className="font-display font-bold text-copper">{i + 1}</span> {s}
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <Eyebrow>Usage allowances</Eyebrow>
              <CheckList className="mt-3 text-sm" items={p.allowances} />
            </section>
          </div>
          <div className="space-y-6">
            <dl className="divide-y divide-line rounded-2xl border border-line bg-white">
              {rows.map(([k, v]) => (
                <div key={k} className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="text-sm text-heading">{v}</dd>
                </div>
              ))}
            </dl>
            <Card className="bg-teal-50">
              <Eyebrow>Exclusions</Eyebrow>
              <ul className="mt-3 space-y-2 text-sm">
                {p.exclusions.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Icon name="x" size={16} className="mt-0.5 shrink-0 text-danger" /> {x}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <Eyebrow>Contract terms</Eyebrow>
              <CheckList className="mt-3 text-sm" items={p.terms.map((t) => t.replace("{{MIN_TERM}}", `${cat.settings.minTermMonths} months`))} />
            </Card>
          </div>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
