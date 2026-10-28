import { portal } from "@/lib/portal";
import { toggleTask } from "@/app/portal/actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { EmptyState } from "@/components/ui/primitives";

const STAGES = ["discover", "design", "build", "prove", "run"] as const;
const STAGE_HELP: Record<string, string> = { discover: "Map the process and agree the owner metric", design: "Design the workflow, approvals and data", build: "Build, integrate and test", prove: "Run in parallel and measure against baseline", run: "Live with monitoring and monthly reviews" };

export default async function Projects() {
  const c = await portal();
  const d = await c.db(async (tx) => ({
    projects: await tx<{ id: string; name: string; stage: string; status: string; accountable_engineer: string | null; start_date: string | null; target_date: string | null }[]>`select id, name, stage, status, accountable_engineer, start_date::text, target_date::text from projects order by created_at`,
    tasks: await tx<{ id: string; project_id: string; title: string; owner: string; status: string; due_date: string | null }[]>`select id, project_id, title, owner, status, due_date::text from onboarding_tasks order by sort`,
  }));
  if (!d.projects.length) return (<><PageTitle title="Projects" /><EmptyState icon="route" title="No projects yet">Your onboarding project appears here after you accept a quote.</EmptyState></>);
  return (
    <>
      <PageTitle title="Projects" description="Where each engagement is in the Elans method, who owns each task, and what we need from you." />
      <div className="space-y-6">
        {d.projects.map((p) => {
          const tasks = d.tasks.filter((t) => t.project_id === p.id);
          const done = tasks.filter((t) => t.status === "done").length;
          const idx = STAGES.indexOf(p.stage as (typeof STAGES)[number]);
          return (
            <Panel key={p.id} title={p.name} actions={<Badge tone={p.status === "on_track" ? "good" : p.status === "done" ? "info" : "bad"}>{p.status.replace("_", " ")}</Badge>}>
              <p className="text-sm text-muted">Accountable engineer: {p.accountable_engineer ?? "to be assigned"} · {p.start_date ?? "—"} to {p.target_date ?? "—"}</p>
              <ol className="mt-4 grid gap-2 sm:grid-cols-5" aria-label="Project stage">
                {STAGES.map((s, i) => (
                  <li key={s} className={`rounded-xl p-3 text-xs ${i < idx ? "bg-success-bg text-success" : i === idx ? "bg-brown text-white" : "bg-surface-2 text-muted"}`} aria-current={i === idx ? "step" : undefined}>
                    <p className="font-semibold capitalize">{i + 1}. {s}</p><p className="mt-0.5 opacity-90">{STAGE_HELP[s]}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Onboarding checklist</h3><span className="text-xs text-muted">{done} of {tasks.length} done</span></div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-success" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></div>
                <ul className="divide-y divide-line">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      {t.owner === "client" ? (
                        <form action={toggleTask.bind(null, t.id)} className="flex items-center gap-2">
                          <button aria-label={t.status === "done" ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`} className={`grid h-5 w-5 place-items-center rounded border ${t.status === "done" ? "border-success bg-success text-white" : "border-line"}`}>{t.status === "done" ? "✓" : ""}</button>
                          <span className={t.status === "done" ? "text-muted line-through" : ""}>{t.title}</span>
                        </form>
                      ) : (
                        <span className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded border ${t.status === "done" ? "border-success bg-success text-white" : "border-line bg-surface-2"}`}>{t.status === "done" ? "✓" : ""}</span><span className={t.status === "done" ? "text-muted line-through" : ""}>{t.title}</span></span>
                      )}
                      <span className="flex shrink-0 gap-1"><Badge tone={t.owner === "client" ? "warn" : "info"}>{t.owner === "client" ? "you" : "Elans"}</Badge>{t.due_date && <Badge>{t.due_date}</Badge>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
