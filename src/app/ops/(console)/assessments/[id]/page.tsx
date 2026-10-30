import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { reviewAssessment } from "@/app/ops/actions";
import type { ReportSections } from "@/lib/engines/assessment";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";

type Props = { params: Promise<{ id: string }> };

export default async function AssessmentReview({ params }: Props) {
  const { id } = await params;
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => {
    const [a] = await tx<{ id: string; state: string; lead_id: string | null; review_notes: string | null }[]>`select id, state, lead_id, review_notes from assessments where id = ${id}`;
    if (!a) return null;
    const [r] = await tx<{ sections: ReportSections; public_token: string; generator: string }[]>`select sections, public_token, generator from reports where assessment_id = ${id}`;
    return { a, r };
  });
  if (!d || !d.r) notFound();
  const s = d.r.sections;
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/assessments", label: "Assessments" }]} title={s.organisation} description={`${s.industryName} · generator ${d.r.generator} · weights v${s.weightVersion ?? "default"}`} actions={<><a href={`/assessment/report/${d.r.public_token}`} target="_blank" className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold ring-1 ring-line">Open client report</a>{d.a.lead_id && <a href={`/ops/leads/${d.a.lead_id}`} className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold ring-1 ring-line">Lead</a>}</>} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Scored opportunities">
            <ol className="space-y-4">
              {s.opportunities.map((o) => (
                <li key={o.slug} className="rounded-xl border border-line p-4">
                  <div className="flex items-center justify-between"><p className="font-semibold">{o.name}</p><span className="font-display text-xl font-bold">{o.score}</span></div>
                  {o.flag !== "none" && <Badge tone="warn">Human review required</Badge>}
                  <p className="mt-2 text-sm text-muted">{o.rationale}</p>
                  <p className="mt-2 rounded-lg bg-surface-2 p-2 text-sm"><strong>Hypothesis:</strong> {o.hypothesis}</p>
                </li>
              ))}
            </ol>
          </Panel>
          {s.exclusions.length > 0 && <Panel title="Exclusions flagged">{s.exclusions.map((e) => <p key={e.topic} className="text-sm"><strong>{e.topic}:</strong> {e.reason}</p>)}</Panel>}
        </div>
        <div className="space-y-6">
          <Panel title="Review">
            <form action={reviewAssessment.bind(null, id)} className="space-y-3">
              <textarea name="notes" defaultValue={d.a.review_notes ?? ""} placeholder="Reviewer notes: do the hypotheses make sense? What to validate in the session?" className="h-32 w-full rounded-lg border border-line bg-surface p-3 text-sm" aria-label="Reviewer notes" />
              <button className="w-full rounded-lg bg-brown py-2 text-sm font-semibold text-white">{d.a.state === "reviewed" ? "Update review" : "Mark reviewed"}</button>
            </form>
          </Panel>
          <Panel title="What they told us">
            <dl className="space-y-2 text-sm">{s.toldUs.map((t) => <div key={t.label}><dt className="text-muted">{t.label}</dt><dd>{t.value}</dd></div>)}</dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
