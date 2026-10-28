import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";

export default async function Assessments() {
  const u = await requireStaff();
  const rows = await asStaff(u, (tx) => tx<{ id: string; state: string; industry: string | null; current_step: number; submitted_at: Date | null; updated_at: Date; organisation: string | null; top: string | null; score: number | null }[]>`
    select a.id, a.state, a.industry, a.current_step, a.submitted_at, a.updated_at, c.organisation,
      (select solution_slug from opportunity_scores s where s.assessment_id = a.id order by score desc limit 1) as top,
      (select max(score) from opportunity_scores s where s.assessment_id = a.id) as score
    from assessments a left join leads l on l.id = a.lead_id left join contacts c on c.id = l.contact_id order by a.updated_at desc limit 200`);
  return (
    <>
      <PageTitle title="Assessments" description="Submitted assessments to review, plus drafts in progress (anonymous until the last step)." />
      <Panel>
        <Table head={["Organisation", "Industry", "State", "Top opportunity", "Score", "Updated"]}>
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-surface-2">
              <td className="px-3 py-2.5">{a.state === "draft" ? <span className="text-muted">Draft (step {a.current_step}/10)</span> : <Link href={`/ops/assessments/${a.id}`} className="font-medium hover:underline">{a.organisation ?? "Unknown"}</Link>}</td>
              <td className="px-3 py-2.5">{a.industry ?? "—"}</td>
              <td className="px-3 py-2.5"><Badge tone={a.state === "submitted" ? "warn" : a.state === "reviewed" ? "good" : "neutral"}>{a.state}</Badge></td>
              <td className="px-3 py-2.5">{a.top ?? "—"}</td>
              <td className="px-3 py-2.5">{a.score ?? "—"}</td>
              <td className="px-3 py-2.5 text-muted">{relTime(a.updated_at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
