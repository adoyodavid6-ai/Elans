import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { portal } from "@/lib/portal";
import { canAdmin, canApprove } from "@/lib/auth";
import { setAutonomy, setKillSwitch } from "@/app/portal/actions";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";
import { EtimsWorkspace } from "@/components/portal/EtimsWorkspace";
import { ReconWorkspace } from "@/components/portal/ReconWorkspace";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

const ACTIONS: Record<string, { key: string; label: string; help: string }[]> = {
  "etims-compliance-reconciliation": [{ key: "etims.supplier_request", label: "Send supplier correction requests", help: "WhatsApp/email to suppliers whose invoices fail the eTIMS check" }],
  "mpesa-bank-reconciliation": [{ key: "recon.send_receipt", label: "Send customer receipts", help: "WhatsApp/SMS receipt after a payment is matched" }],
  "whatsapp-sales-support-agent": [{ key: "converse.reply", label: "Reply to customers", help: "Answers grounded in your catalogue; discounts and refunds always go to a person" }],
};

export default async function AutomationPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const c = await portal();
  const keyword = { etims: "etims-compliance-reconciliation", reconciliation: "mpesa-bank-reconciliation", whatsapp: "whatsapp-sales-support-agent" }[id];
  if (keyword) {
    const inst = await c.db(async (tx) => (await tx<{ id: string }[]>`select id from engine_instances where solution_slug = ${keyword} limit 1`)[0]);
    if (inst) redirect(`/portal/automations/${inst.id}`);
    notFound();
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await c.db(async (tx) => {
    const [inst] = await tx<{ id: string; name: string; solution_slug: string; status: string; kill_switch: boolean; autonomy: Record<string, string>; owner_metric: string; baseline_value: number | null; baseline_note: string | null; config: Record<string, unknown>; template_version: string; monthly_budget: number }[]>`select * from engine_instances where id = ${id}`;
    if (!inst) return null;
    const runs = await tx<{ id: string; trigger: string; status: string; started_at: Date; finished_at: Date | null; cost: number; error: string | null; steps: number }[]>`
      select r.id, r.trigger, r.status, r.started_at, r.finished_at, r.cost, r.error, (select count(*)::int from run_steps s where s.run_id = r.id) as steps from runs r where r.engine_instance_id = ${id} order by r.started_at desc limit 25`;
    return { inst, runs };
  });
  if (!d) notFound();
  const { inst } = d;
  const tabs = [
    { key: "work", label: inst.solution_slug === "whatsapp-sales-support-agent" ? "Conversations" : "Workspace" },
    { key: "runs", label: "Run history" },
    { key: "controls", label: "Controls & autonomy" },
  ];
  const active = tab ?? "work";
  return (
    <>
      <PageTitle crumbs={[{ href: "/portal/automations", label: "My Automations" }]} title={inst.name} description={`Owner metric: ${inst.owner_metric}${inst.baseline_value !== null ? ` · baseline ${inst.baseline_value}% (${inst.baseline_note})` : ""}`} actions={<span className="flex gap-1">{inst.kill_switch && <Badge tone="bad">kill switch on</Badge>}<Badge tone={inst.status === "live" ? "good" : "info"}>{inst.status}</Badge></span>} />
      <nav aria-label="Automation sections" className="mb-6 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link key={t.key} href={`/portal/automations/${id}?tab=${t.key}`} aria-current={active === t.key ? "page" : undefined} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${active === t.key ? "border-brown text-heading" : "border-transparent text-muted hover:text-heading"}`}>{t.label}</Link>
        ))}
      </nav>
      {active === "work" && inst.solution_slug === "etims-compliance-reconciliation" && <EtimsWorkspace ctx={c} instanceId={id} />}
      {active === "work" && inst.solution_slug === "mpesa-bank-reconciliation" && <ReconWorkspace ctx={c} instanceId={id} />}
      {active === "work" && inst.solution_slug === "whatsapp-sales-support-agent" && (
        <Panel><p className="text-sm">This agent&apos;s conversations live in <Link href="/portal/conversations" className="font-semibold text-copper-ink underline">Agents & Conversations</Link>, including the WhatsApp simulator, handovers and take-over.</p></Panel>
      )}
      {active === "runs" && (
        <Panel title="Run history">
          <Table head={["Run", "Trigger", "Status", "Steps", "Cost (USD)", "Started"]}>
            {d.runs.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2">
                <td className="px-3 py-2"><Link href={`/portal/runs/${r.id}`} className="font-mono text-xs text-copper-ink hover:underline">{r.id.slice(0, 8)}</Link></td>
                <td className="px-3 py-2 text-xs">{r.trigger}</td>
                <td className="px-3 py-2"><Badge tone={r.status === "succeeded" ? "good" : r.status === "failed" ? "bad" : r.status === "blocked" ? "bad" : "warn"}>{r.status.replace("_", " ")}</Badge>{r.error && <p className="text-xs text-danger">{r.error}</p>}</td>
                <td className="px-3 py-2">{r.steps}</td>
                <td className="px-3 py-2">{Number(r.cost).toFixed(4)}</td>
                <td className="px-3 py-2 text-muted">{relTime(r.started_at)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
      {active === "controls" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Kill switch">
            <p className="text-sm text-muted">Stops this automation from taking any action immediately. Incoming work is still recorded so nothing is lost. Requires approver role.</p>
            <form action={setKillSwitch.bind(null, id, !inst.kill_switch)} className="mt-4">
              <button disabled={!canApprove(c.role)} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${inst.kill_switch ? "bg-success" : "bg-danger"}`}>{inst.kill_switch ? "Turn kill switch off (resume)" : "Turn kill switch on (stop all actions)"}</button>
            </form>
          </Panel>
          <Panel title="Autonomy per action type">
            <p className="mb-4 text-sm text-muted">By default every customer-facing or financial action waits for approval. Owners and admins may opt in to autonomy for specific, low-risk action types. Changes are audited.</p>
            <ul className="space-y-4">
              {(ACTIONS[inst.solution_slug] ?? []).map((a) => {
                const v = inst.autonomy?.[a.key] === "auto" ? "auto" : "approve";
                return (
                  <li key={a.key} className="rounded-xl border border-line p-4">
                    <p className="font-semibold">{a.label}</p>
                    <p className="text-xs text-muted">{a.help}</p>
                    <div className="mt-3 flex gap-2">
                      {(["approve", "auto"] as const).map((opt) => (
                        <form key={opt} action={setAutonomy.bind(null, id, a.key, opt)}>
                          <button disabled={!(canAdmin(c.role) || c.isDemo)} aria-pressed={v === opt} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ${v === opt ? "bg-brown text-white ring-brown" : "bg-surface ring-line"}`}>{opt === "approve" ? "Ask me first" : "Do it automatically"}</button>
                        </form>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Configuration">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Template version</dt><dd>v{inst.template_version}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Monthly AI/usage budget</dt><dd>KES {Number(inst.monthly_budget).toLocaleString("en-GB")}</dd></div>
              {Object.entries(inst.config).filter(([k]) => ["buyerPin", "period", "threshold", "autoApplyThreshold", "businessName", "paybill"].includes(k)).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{String(v)}</dd></div>)}
            </dl>
            <p className="mt-3 text-xs text-muted">Configuration changes go through your Elans engineer as a change request.</p>
          </Panel>
        </div>
      )}
    </>
  );
}
