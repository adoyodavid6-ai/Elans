import Link from "next/link";
import { notFound } from "next/navigation";
import { portal } from "@/lib/portal";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { Icon } from "@/components/ui/Icon";

type Props = { params: Promise<{ id: string }> };
const KIND_ICON: Record<string, string> = { rule: "layers", ai: "spark", action: "bolt", review: "user", approval: "shield" };

export default async function RunPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await portal();
  const d = await c.db(async (tx) => {
    const [run] = await tx<{ id: string; engine_instance_id: string; trigger: string; idempotency_key: string; status: string; input: Record<string, unknown>; output: Record<string, unknown>; cost: number; error: string | null; started_at: Date; finished_at: Date | null; name: string }[]>`select r.*, e.name from runs r join engine_instances e on e.id = r.engine_instance_id where r.id = ${id}`;
    if (!run) return null;
    const steps = await tx<{ seq: number; name: string; kind: string; status: string; input_hash: string | null; output: unknown; confidence: number | null; model: string | null; prompt_version: string | null; attempts: number; duration_ms: number | null; error: string | null }[]>`select seq, name, kind, status, input_hash, output, confidence, model, prompt_version, attempts, duration_ms, error from run_steps where run_id = ${id} order by seq`;
    return { run, steps };
  });
  if (!d) notFound();
  const { run } = d;
  return (
    <>
      <PageTitle crumbs={[{ href: "/portal/automations", label: "My Automations" }, { href: `/portal/automations/${run.engine_instance_id}?tab=runs`, label: run.name }]} title={`Run ${run.id.slice(0, 8)}`} description={`${run.trigger} · started ${run.started_at.toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })} · idempotency key ${run.idempotency_key.slice(0, 20)}…`} actions={<Badge tone={run.status === "succeeded" ? "good" : run.status === "failed" ? "bad" : "warn"}>{run.status.replace("_", " ")}</Badge>} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Step ledger (audit trail)">
          <ol className="space-y-3">
            {d.steps.map((s) => (
              <li key={s.seq} className="flex gap-3 rounded-xl border border-line p-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${s.status === "failed" ? "bg-danger-bg text-danger" : s.status === "waiting" ? "bg-warning-bg text-warning" : "bg-surface-2"}`}><Icon name={KIND_ICON[s.kind] ?? "bolt"} size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-heading">{s.seq}. {s.name}</p>
                    <span className="flex gap-1 text-xs"><Badge>{s.kind}</Badge><Badge tone={s.status === "succeeded" ? "good" : s.status === "failed" ? "bad" : "warn"}>{s.status}</Badge></span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.model && <>model {s.model} · </>}{s.prompt_version && <>prompt {s.prompt_version} · </>}{s.confidence !== null && <>confidence {Number(s.confidence).toFixed(2)} · </>}attempts {s.attempts}{s.duration_ms !== null && <> · {s.duration_ms} ms</>}{s.input_hash && <> · input #{s.input_hash.slice(0, 10)}</>}
                  </p>
                  {s.error && <p className="mt-1 text-xs text-danger">{s.error}</p>}
                  {s.output !== null && JSON.stringify(s.output) !== "{}" && (
                    <details className="mt-1"><summary className="cursor-pointer text-xs text-copper-ink">Output</summary><pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-surface-2 p-2 text-[0.7rem]">{JSON.stringify(s.output, null, 2)}</pre></details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="space-y-6">
          <Panel title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Status</dt><dd>{run.status}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Finished</dt><dd>{run.finished_at ? run.finished_at.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" }) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Model cost</dt><dd>USD {Number(run.cost).toFixed(4)}</dd></div>
            </dl>
            {run.error && <p className="mt-3 rounded-lg bg-danger-bg p-2 text-sm text-danger">{run.error}</p>}
          </Panel>
          <Panel title="Input & output"><pre className="max-h-80 overflow-auto rounded-lg bg-surface-2 p-2 text-[0.7rem]">{JSON.stringify({ input: run.input, output: run.output }, null, 2)}</pre></Panel>
          <Link href="/portal/approvals" className="block text-sm text-copper-ink underline">Go to approvals</Link>
        </div>
      </div>
    </>
  );
}
