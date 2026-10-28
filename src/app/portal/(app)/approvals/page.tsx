import Link from "next/link";
import { portal } from "@/lib/portal";
import { canApprove } from "@/lib/auth";
import { decideApproval, decideClientReview, decideContent } from "@/app/portal/actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";
import { EmptyState } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/core/money";

type Cand = { receivableId: string; number: string; customer: string; balance: number; confidence: number; reasons: string[] };

export default async function Approvals() {
  const c = await portal();
  const can = canApprove(c.role);
  const d = await c.db(async (tx) => ({
    approvals: await tx<{ id: string; action_type: string; title: string; summary: string; proposed: { message?: string; channel?: string; to?: string; supplierName?: string }; created_at: Date; name: string; run_id: string | null }[]>`
      select a.id, a.action_type, a.title, a.summary, a.proposed, a.created_at, e.name, a.run_id from approvals a join engine_instances e on e.id = a.engine_instance_id where a.status = 'pending' order by a.created_at limit 50`,
    reviews: await tx<{ id: string; kind: string; title: string; payload: { candidates?: Cand[]; row?: { amount: number; reference?: string } }; sla_due_at: Date; created_at: Date }[]>`
      select id, kind, title, payload, sla_due_at, created_at from review_items where status = 'open' and queue = 'client' order by sla_due_at limit 50`,
    elansReviews: await tx<{ n: number }[]>`select count(*)::int as n from review_items where status = 'open' and queue = 'elans'`,
    content: await tx<{ id: string; kind: string; title: string; body: string | null; ai_generated: boolean; scheduled_for: Date | null; campaign: string | null }[]>`
      select s.id, s.kind, s.title, s.body, s.ai_generated, s.scheduled_for, c.name as campaign from studio_items s left join campaigns c on c.id = s.campaign_id where s.status = 'awaiting_client' order by s.created_at limit 50`,
    recent: await tx<{ title: string; status: string; decided_by: string | null; decided_at: Date | null }[]>`select title, status, decided_by, decided_at from approvals where status <> 'pending' order by decided_at desc nulls last limit 8`,
  }));
  const total = d.approvals.length + d.reviews.length + d.content.length;
  return (
    <>
      <PageTitle title="Approvals" description="Nothing customer-facing or financial happens without a person, unless you have opted in to autonomy for that action type. Edit a message before approving if you like." />
      {!can && <p className="mb-4 rounded-xl bg-warning-bg p-3 text-sm text-warning">Your role ({c.role}) can view but not decide. Ask an approver or admin.</p>}
      {d.elansReviews[0].n > 0 && <p className="mb-4 rounded-xl bg-info-bg p-3 text-sm text-info">{d.elansReviews[0].n} unclear invoice extraction{d.elansReviews[0].n === 1 ? " is" : "s are"} being checked by the Elans review team. They continue automatically once confirmed.</p>}
      {total === 0 && <EmptyState icon="check" title="You're all caught up">New approvals appear here and in your notifications.</EmptyState>}
      <div className="space-y-6">
        {d.approvals.length > 0 && (
          <Panel title={`Actions waiting for approval (${d.approvals.length})`}>
            <ul className="space-y-4">
              {d.approvals.map((a) => (
                <li key={a.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-heading">{a.title}</p><span className="flex gap-1"><Badge tone="brand">{a.name}</Badge><Badge>{relTime(a.created_at)}</Badge></span></div>
                  <p className="mt-1 text-sm text-muted">Why: {a.summary}</p>
                  <form className="mt-3 space-y-2">
                    {a.proposed.message !== undefined && (
                      <>
                        <label htmlFor={`m-${a.id}`} className="text-xs font-semibold">Message to {a.proposed.supplierName ?? a.proposed.to ?? "recipient"} via {a.proposed.channel ?? "WhatsApp"} (editable)</label>
                        <textarea id={`m-${a.id}`} name="message" rows={3} defaultValue={a.proposed.message} className="w-full rounded-lg border border-line bg-surface p-2 text-sm" />
                      </>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button formAction={decideApproval.bind(null, a.id, true)} disabled={!can} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve & send</button>
                      <button formAction={decideApproval.bind(null, a.id, false)} disabled={!can} className="rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-line disabled:opacity-50">Reject</button>
                      {a.run_id && <Link href={`/portal/runs/${a.run_id}`} className="self-center text-xs text-copper-ink underline">See audit trail</Link>}
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {d.reviews.length > 0 && (
          <Panel title={`Payments to confirm (${d.reviews.length})`}>
            <ul className="space-y-4">
              {d.reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{r.title}</p><Badge tone={r.sla_due_at < new Date() ? "bad" : "neutral"}>due {relTime(r.sla_due_at)}</Badge></div>
                  <form action={decideClientReview.bind(null, r.id)} className="mt-3 space-y-2">
                    <fieldset>
                      <legend className="text-xs font-semibold">Which invoice is this payment for?</legend>
                      <div className="mt-2 space-y-1.5">
                        {(r.payload.candidates ?? []).map((cand, i) => (
                          <label key={cand.receivableId} className="flex items-start gap-2 rounded-lg p-2 ring-1 ring-line">
                            <input type="radio" name="receivableId" value={cand.receivableId} defaultChecked={i === 0} className="mt-1" />
                            <span className="text-sm"><b>{cand.number}</b> · {cand.customer} · balance {formatMoney(Number(cand.balance))} · <span className="text-muted">confidence {cand.confidence.toFixed(2)}: {cand.reasons.join(", ")}</span></span>
                          </label>
                        ))}
                        {(r.payload.candidates ?? []).length === 0 && <p className="text-sm text-muted">No likely match found. You can mark it as not ours, or raise a support ticket for manual allocation.</p>}
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap gap-2">
                      {(r.payload.candidates ?? []).length > 0 && <button name="decision" value="correct" disabled={!can} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Apply to selected invoice</button>}
                      <button name="decision" value="reject" disabled={!can} formNoValidate className="rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-line disabled:opacity-50">Not ours / ignore</button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {d.content.length > 0 && (
          <Panel title={`Content waiting for sign-off (${d.content.length})`}>
            <ul className="grid gap-4 lg:grid-cols-2">
              {d.content.map((s) => (
                <li key={s.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{s.title}</p><span className="flex gap-1"><Badge>{s.kind.replace("_", " ")}</Badge>{s.ai_generated && <Badge tone="info">AI-assisted</Badge>}</span></div>
                  {s.campaign && <p className="text-xs text-muted">Campaign: {s.campaign}{s.scheduled_for ? ` · scheduled ${s.scheduled_for.toLocaleDateString("en-GB")}` : ""}</p>}
                  {s.body && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm">{s.body}</p>}
                  <form className="mt-3 space-y-2">
                    <label htmlFor={`f-${s.id}`} className="sr-only">Feedback</label>
                    <input id={`f-${s.id}`} name="feedback" placeholder="Feedback (needed if requesting changes)" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button formAction={decideContent.bind(null, s.id, true)} disabled={!can} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
                      <button formAction={decideContent.bind(null, s.id, false)} disabled={!can} className="rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-line disabled:opacity-50">Request changes</button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {d.recent.length > 0 && (
          <Panel title="Recently decided">
            <ul className="divide-y divide-line text-sm">{d.recent.map((r, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2"><span>{r.title}</span><span className="text-muted"><Badge tone={r.status === "approved" ? "good" : "neutral"}>{r.status}</Badge> {r.decided_by} · {r.decided_at ? relTime(r.decided_at) : ""}</span></li>)}</ul>
          </Panel>
        )}
      </div>
    </>
  );
}
