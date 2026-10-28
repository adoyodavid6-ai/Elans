import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { asStaff, OPP_STAGES } from "@/lib/ops/data";
import { createQuote, moveOpportunity, saveDiagnostic } from "@/app/ops/actions";
import { formatMoney } from "@/lib/core/money";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";

type Props = { params: Promise<{ id: string }> };
const input = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm";

export default async function OpportunityPage({ params }: Props) {
  const { id } = await params;
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => {
    const [o] = await tx<{ id: string; name: string; stage: string; value: number; close_date: Date | null; lead_id: string | null; diagnostic: Record<string, string | number>; notes: string | null }[]>`select * from opportunities where id = ${id}`;
    if (!o) return null;
    const quotes = await tx<{ id: string; number: string; status: string; totals: { contractValue?: number; grossMargin?: number }; created_at: Date }[]>`select id, number, status, totals, created_at from quotes where opportunity_id = ${id} order by created_at desc`;
    const scores = o.lead_id ? await tx<{ solution_slug: string; score: number; flag: string }[]>`select s.solution_slug, s.score, s.flag from opportunity_scores s join assessments a on a.id = s.assessment_id where a.lead_id = ${o.lead_id} order by s.score desc limit 5` : [];
    return { o, quotes, scores };
  });
  if (!d) notFound();
  const { o } = d;
  const g = o.diagnostic ?? {};
  const hoursYear = (Number(g.monthlyVolume ?? 0) * Number(g.minutesPerTask ?? 0) * 12) / 60;
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/pipeline", label: "Pipeline" }]} title={o.name} description={`Value ${formatMoney(Number(o.value))}`} actions={
        <form action={async (fd: FormData) => { "use server"; await moveOpportunity(id, String(fd.get("stage"))); }} className="flex gap-2">
          <select name="stage" defaultValue={o.stage} aria-label="Stage" className="h-10 rounded-lg border border-line bg-surface px-2 text-sm">{OPP_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          <button className="rounded-lg bg-surface-2 px-3 text-sm font-semibold ring-1 ring-line">Update stage</button>
        </form>
      } />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Automation Diagnostic workspace">
          <p className="mb-4 text-sm text-muted">Capture the measured baseline before proposing. The 90-day value drives the quote sanity check (setup ≈ one-third of it).</p>
          <form action={saveDiagnostic.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">Opportunity name</span><input name="name" defaultValue={o.name} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Estimated contract value (KES)</span><input name="value" type="number" defaultValue={o.value} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Expected close date</span><input name="closeDate" type="date" defaultValue={o.close_date ? new Date(o.close_date).toISOString().slice(0, 10) : ""} className={input} /></label>
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">Owner metric</span><input name="ownerMetric" defaultValue={String(g.ownerMetric ?? "")} placeholder="e.g. % of claimed expenses with valid eTIMS support" className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Baseline value</span><input name="baselineValue" defaultValue={String(g.baselineValue ?? "")} placeholder="e.g. 62%" className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Data readiness (0–5)</span><input name="dataReadiness" type="number" min={0} max={5} step={0.5} defaultValue={Number(g.dataReadiness ?? 3)} className={input} /></label>
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">How the baseline was measured</span><textarea name="baselineNote" defaultValue={String(g.baselineNote ?? "")} className={`${input} h-20 py-2`} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Volume per month</span><input name="monthlyVolume" type="number" defaultValue={Number(g.monthlyVolume ?? 0)} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Minutes per task</span><input name="minutesPerTask" type="number" defaultValue={Number(g.minutesPerTask ?? 0)} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Error rate (%)</span><input name="errorRatePct" type="number" defaultValue={Number(g.errorRatePct ?? 0)} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Projected 90-day value to client (KES)</span><input name="value90" type="number" defaultValue={Number(g.value90 ?? 0)} className={input} /></label>
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">Risks & dependencies</span><textarea name="risks" defaultValue={String(g.risks ?? "")} className={`${input} h-20 py-2`} /></label>
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">Notes</span><textarea name="notes" defaultValue={o.notes ?? ""} className={`${input} h-20 py-2`} /></label>
            <div className="flex items-center justify-between sm:col-span-2">
              <p className="text-xs text-muted">{g.capturedBy ? `Last captured by ${g.capturedBy}` : "Not captured yet"} · Baseline workload ≈ {Math.round(hoursYear).toLocaleString("en-GB")} h/year</p>
              <button className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Save diagnostic</button>
            </div>
          </form>
        </Panel>
        <div className="space-y-6">
          <Panel title="Quotes" actions={<form action={createQuote.bind(null, id)}><button className="rounded-lg bg-brown px-3 py-1.5 text-sm font-semibold text-white">New quote</button></form>}>
            {d.quotes.length === 0 ? <p className="text-sm text-muted">No quotes yet.</p> : (
              <Table head={["Quote", "Status", "Contract value", "Margin"]}>
                {d.quotes.map((q) => (
                  <tr key={q.id}><td className="px-3 py-2"><Link href={`/ops/quotes/${q.id}`} className="font-medium hover:underline">{q.number}</Link></td><td className="px-3 py-2"><Badge tone={q.status === "accepted" ? "good" : q.status === "sent" ? "info" : "neutral"}>{q.status}</Badge></td><td className="px-3 py-2">{q.totals?.contractValue ? formatMoney(q.totals.contractValue) : "—"}</td><td className="px-3 py-2">{q.totals?.grossMargin !== undefined ? `${(q.totals.grossMargin * 100).toFixed(0)}%` : "—"}</td></tr>
                ))}
              </Table>
            )}
          </Panel>
          <Panel title="Assessment scores for this lead">
            {d.scores.length === 0 ? <p className="text-sm text-muted">No assessment linked.</p> : (
              <ul className="space-y-1.5 text-sm">{d.scores.map((s) => <li key={s.solution_slug} className="flex justify-between"><span>{s.solution_slug}</span><span className="font-semibold">{s.score}{s.flag !== "none" && <Badge tone="warn">review</Badge>}</span></li>)}</ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
