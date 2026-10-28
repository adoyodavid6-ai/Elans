import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { getCatalogue } from "@/lib/content";
import { PageTitle } from "@/components/app/AppShell";
import { QuoteBuilder } from "@/components/app/QuoteBuilder";
import type { QuoteLine } from "@/lib/core/quote";

type Props = { params: Promise<{ id: string }> };

export default async function QuotePage({ params }: Props) {
  const { id } = await params;
  const u = await requireStaff();
  const q = await asStaff(u, async (tx) => {
    const [row] = await tx<{ id: string; number: string; status: string; lines: QuoteLine[]; term_months: number; split_setup: boolean; totals: { discountPct?: number }; opportunity_id: string; public_token: string | null; accepted_name: string | null }[]>`select * from quotes where id = ${id}`;
    if (!row) return null;
    const [o] = await tx<{ name: string; diagnostic: { value90?: number }; email: string | null }[]>`select o.name, o.diagnostic, c.email from opportunities o left join leads l on l.id = o.lead_id left join contacts c on c.id = l.contact_id where o.id = ${row.opportunity_id}`;
    return { ...row, opp: o };
  });
  if (!q) notFound();
  const cat = await getCatalogue();
  const presets = [
    ...cat.packages.filter((p) => p.key !== "enterprise").flatMap((p) => [
      { label: `${p.name} setup`, kind: "setup" as const, amount: cat.pricePoints.find((x) => x.key === p.setupKey)?.amount ?? 0 },
      { label: `${p.name} monthly retainer`, kind: "monthly" as const, amount: cat.pricePoints.find((x) => x.key === p.monthlyKey)?.amount ?? 0 },
    ]),
    { label: "Automation Diagnostic (credited)", kind: "one_off" as const, amount: cat.pricePoints.find((x) => x.key === "diagnostic")?.amount ?? 0 },
    { label: "Usage: WhatsApp conversations (est.)", kind: "usage" as const, amount: 5000 },
    { label: "Usage: document pages (est.)", kind: "usage" as const, amount: 4000 },
  ];
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/pipeline", label: "Pipeline" }, { href: `/ops/opportunities/${q.opportunity_id}`, label: q.opp?.name ?? "Opportunity" }]} title={`Quote ${q.number}`} description="Prices default to the catalogue. Costs are Elans' internal delivery estimates and never shown to the client." />
      <QuoteBuilder
        id={q.id}
        status={q.status}
        initial={{ lines: q.lines, termMonths: q.term_months, discountPct: q.totals?.discountPct ?? 0, splitSetup: q.split_setup }}
        value90={Number(q.opp?.diagnostic?.value90 ?? 0)}
        marginFloor={cat.settings.marginFloor}
        minTerm={cat.settings.minTermMonths}
        presets={presets}
        solutions={cat.solutions.map((s) => ({ slug: s.slug, name: s.name }))}
        clientEmail={q.opp?.email ?? ""}
        publicUrl={q.public_token ? `/quote/${q.public_token}` : null}
        acceptedBy={q.accepted_name}
      />
    </>
  );
}
