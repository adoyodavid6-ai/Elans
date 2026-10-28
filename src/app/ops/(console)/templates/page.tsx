import { requireStaff } from "@/lib/auth";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { getCatalogue } from "@/lib/content";
import { PageTitle, Panel, Table, Badge } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";

export default async function TemplatesAdmin() {
  const u = await requireStaff();
  const cat = await getCatalogue({ includeDrafts: true });
  const d = await withDb({ tenantId: INTERNAL_TENANT_ID, userId: u.id }, async (tx) => ({
    evals: await tx<{ prompt_key: string; version: string; mode: string; score: number; cases: number; created_at: Date; details: { fieldAccuracy?: number; statusAccuracy?: number } }[]>`select * from eval_runs order by created_at desc limit 20`,
    prompts: await tx<{ prompt_key: string; version: string; model: string | null; eval_score: number | null; active: boolean; created_at: Date }[]>`select prompt_key, version, model, eval_score, active, created_at from prompt_versions order by created_at desc`,
  }));
  return (
    <>
      <PageTitle title="Templates, prompts & evaluations" description="Internal registry. Eval scores are internal only and never shown publicly. Run evaluations with `npm run eval:etims`." />
      <div className="space-y-6">
        <Panel title="Evaluation runs">
          {d.evals.length === 0 ? <p className="text-sm text-muted">No evaluation runs recorded yet.</p> : (
            <Table head={["Prompt", "Mode", "Cases", "Field accuracy", "Status accuracy", "Overall", "When"]}>
              {d.evals.map((e, i) => <tr key={i}><td className="px-3 py-2 font-mono text-xs">{e.prompt_key}@{e.version}</td><td className="px-3 py-2">{e.mode}</td><td className="px-3 py-2">{e.cases}</td><td className="px-3 py-2">{e.details.fieldAccuracy !== undefined ? `${(e.details.fieldAccuracy * 100).toFixed(1)}%` : "—"}</td><td className="px-3 py-2">{e.details.statusAccuracy !== undefined ? `${(e.details.statusAccuracy * 100).toFixed(1)}%` : "—"}</td><td className="px-3 py-2"><Badge tone={Number(e.score) >= 0.9 ? "good" : "warn"}>{(Number(e.score) * 100).toFixed(1)}%</Badge></td><td className="px-3 py-2 text-muted">{relTime(e.created_at)}</td></tr>)}
            </Table>
          )}
        </Panel>
        <Panel title="Prompt versions">
          {d.prompts.length === 0 ? <p className="text-sm text-muted">Prompt versions are registered when an evaluation runs.</p> : (
            <Table head={["Prompt", "Model", "Eval score", "Active", "Created"]}>{d.prompts.map((p, i) => <tr key={i}><td className="px-3 py-2 font-mono text-xs">{p.prompt_key}@{p.version}</td><td className="px-3 py-2">{p.model}</td><td className="px-3 py-2">{p.eval_score ?? "—"}</td><td className="px-3 py-2">{p.active ? <Badge tone="good">active</Badge> : ""}</td><td className="px-3 py-2 text-muted">{relTime(p.created_at)}</td></tr>)}</Table>
          )}
        </Panel>
        <Panel title="Template registry">
          <Table head={["Template", "Version", "Maintenance", "Security", "Eval (internal)"]}>
            {cat.templates.map((t) => <tr key={t.slug}><td className="px-3 py-2">{t.name}</td><td className="px-3 py-2 font-mono text-xs">v{t.version}</td><td className="px-3 py-2"><Badge tone={t.maintenance === "active" ? "good" : t.maintenance === "beta" ? "info" : "neutral"}>{t.maintenance}</Badge></td><td className="px-3 py-2">{t.securityClass}</td><td className="px-3 py-2">{t.evalScore !== undefined ? t.evalScore : "—"}</td></tr>)}
          </Table>
        </Panel>
      </div>
    </>
  );
}
