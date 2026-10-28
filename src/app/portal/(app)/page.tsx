import Link from "next/link";
import { portal } from "@/lib/portal";
import { formatMoney, formatNumber } from "@/lib/core/money";
import { Badge, Kpi, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";
import { varianceReport } from "@/lib/solutions/etims/workflow";

export default async function Overview() {
  const c = await portal();
  const d = await c.db(async (tx) => {
    const instances = await tx<{ id: string; name: string; solution_slug: string; status: string; owner_metric: string; baseline_value: number | null; baseline_note: string | null; kill_switch: boolean; config: Record<string, unknown> }[]>`select id, name, solution_slug, status, owner_metric, baseline_value, baseline_note, kill_switch, config from engine_instances order by created_at`;
    const [runs] = await tx<{ ok: number; failed: number; waiting: number }[]>`select count(*) filter (where status = 'succeeded')::int as ok, count(*) filter (where status = 'failed')::int as failed, count(*) filter (where status like 'waiting%')::int as waiting from runs where started_at > now() - interval '30 days'`;
    const [q] = await tx<{ approvals: number; reviews: number; incidents: number; tickets: number }[]>`select (select count(*)::int from approvals where status = 'pending') as approvals, (select count(*)::int from review_items where status = 'open') as reviews, (select count(*)::int from incidents where status <> 'resolved') as incidents, (select count(*)::int from tickets where status in ('open','pending')) as tickets`;
    const usage = await tx<{ meter: string; q: number }[]>`select meter, sum(quantity)::float as q from usage_events where created_at > date_trunc('month', now()) group by meter`;
    const [sub] = await tx<{ package_key: string; monthly_amount: number; allowances: Record<string, number> }[]>`select package_key, monthly_amount, allowances from subscriptions where status = 'active' limit 1`;
    const [recon] = await tx<{ total: number; auto: number }[]>`select count(*)::int as total, count(*) filter (where match_method = 'auto')::int as auto from recon_transactions`;
    const [conv] = await tx<{ total: number; resolved: number }[]>`select count(*)::int as total, count(*) filter (where resolution = 'resolved')::int as resolved from conversations where channel = 'whatsapp'`;
    const etims = instances.find((i) => i.solution_slug === "etims-compliance-reconciliation");
    const vr = etims ? await varianceReport(tx, etims.id, String(etims.config.period ?? "")) : null;
    const activity = await tx<{ actor_label: string | null; action: string; created_at: Date }[]>`select actor_label, action, created_at from audit_log order by created_at desc limit 8`;
    const campaigns = await tx<{ name: string; kpis: Record<string, number> }[]>`select name, kpis from campaigns where status = 'active' limit 3`;
    return { instances, runs, q, usage, sub, recon, conv, vr, activity, campaigns };
  });
  const docPages = d.usage.find((u) => u.meter === "doc_page")?.q ?? 0;
  const txns = d.usage.find((u) => u.meter === "txn_reconciled")?.q ?? 0;
  // Estimated hours saved: an estimate from the per-item minutes captured in the Diagnostic (labelled as such).
  const hours = (docPages * 4 + txns * 3) / 60;
  const autoPct = d.recon.total ? d.recon.auto / d.recon.total : 0;
  return (
    <>
      <PageTitle title={`Welcome, ${c.user.name.split(" ")[0]}`} description={`${c.tenantName} · ${d.instances.length} automations · ${d.sub ? `${d.sub.package_key} package` : "no active package"}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Pending approvals" value={d.q.approvals} href="/portal/approvals" tone={d.q.approvals ? "warn" : undefined} />
        <Kpi label="Runs (30 days)" value={d.runs.ok + d.runs.failed + d.runs.waiting} hint={`${d.runs.ok} succeeded · ${d.runs.failed} failed · ${d.runs.waiting} waiting`} href="/portal/health" />
        <Kpi label="Open incidents" value={d.q.incidents} tone={d.q.incidents ? "bad" : "good"} href="/portal/health" />
        <Kpi label="Hours saved (estimate)" value={formatNumber(hours, 1)} hint="Labour capacity, this month" />
        <Kpi label="WhatsApp resolution" value={d.conv.total ? `${Math.round((d.conv.resolved / d.conv.total) * 100)}%` : "—"} hint={`${d.conv.resolved} of ${d.conv.total} resolved`} href="/portal/conversations" />
        <Kpi label="Support tickets" value={d.q.tickets} href="/portal/support" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Outcomes vs baseline">
          <ul className="space-y-5">
            {d.instances.map((i) => {
              let current: string | null = null;
              let num: number | null = null;
              if (i.solution_slug === "etims-compliance-reconciliation" && d.vr) {
                num = d.vr.pctSupported * 100;
                current = `${num.toFixed(0)}% supported · ${formatMoney(d.vr.atRisk)} at risk`;
              } else if (i.solution_slug === "mpesa-bank-reconciliation") {
                num = autoPct * 100;
                current = `${num.toFixed(0)}% auto-matched`;
              } else if (i.solution_slug === "whatsapp-sales-support-agent") {
                num = d.conv.total ? (d.conv.resolved / d.conv.total) * 100 : 0;
                current = `${num.toFixed(0)}% resolved without handover`;
              }
              return (
                <li key={i.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/portal/automations/${i.id}`} className="font-semibold text-heading hover:underline">{i.name}</Link>
                    <span>{i.kill_switch ? <Badge tone="bad">killed</Badge> : <Badge tone={i.status === "live" ? "good" : "info"}>{i.status}</Badge>}</span>
                  </div>
                  <p className="text-xs text-muted">Owner metric: {i.owner_metric}</p>
                  {num !== null && (
                    <div className="mt-2">
                      <div className="relative h-2.5 rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-copper" style={{ width: `${Math.min(100, num)}%` }} />
                        {i.baseline_value !== null && <span className="absolute -top-1 h-4.5 w-0.5 bg-espresso" style={{ left: `${Math.min(100, Number(i.baseline_value))}%` }} title={`Baseline ${i.baseline_value}%`} />}
                      </div>
                      <p className="mt-1 text-xs"><strong>Now:</strong> {current}{i.baseline_value !== null && <> · <strong>Baseline:</strong> {i.baseline_value}% <span className="text-muted">({i.baseline_note})</span></>}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
        <div className="space-y-6">
          <Panel title="Usage this month" actions={<Link href="/portal/billing" className="text-sm text-copper-ink hover:underline">Billing</Link>}>
            <ul className="space-y-3 text-sm">
              {Object.entries(d.sub?.allowances ?? {}).map(([k, allowance]) => {
                const meterKey = k === "document_pages" ? "doc_page" : k === "wa_conversations" ? "wa_conversation" : k;
                const used = d.usage.find((u) => u.meter === meterKey)?.q ?? 0;
                return (
                  <li key={k}>
                    <div className="flex justify-between"><span>{k.replace(/_/g, " ")}</span><span>{formatNumber(used)} / {formatNumber(allowance)}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-surface-2"><div className={`h-full rounded-full ${used > allowance ? "bg-danger" : "bg-success"}`} style={{ width: `${Math.min(100, (used / allowance) * 100)}%` }} /></div>
                  </li>
                );
              })}
              {d.sub && <li className="flex justify-between border-t border-line pt-3"><span>Monthly retainer</span><strong>{formatMoney(Number(d.sub.monthly_amount))}</strong></li>}
            </ul>
          </Panel>
          {d.campaigns.length > 0 && (
            <Panel title="Campaign KPIs" actions={<Link href="/portal/campaigns" className="text-sm text-copper-ink hover:underline">Campaigns</Link>}>
              <ul className="space-y-2 text-sm">{d.campaigns.map((cp) => <li key={cp.name}><p className="font-medium">{cp.name}</p><p className="text-xs text-muted">{Object.entries(cp.kpis).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</p></li>)}</ul>
            </Panel>
          )}
          <Panel title="Recent activity">
            <ul className="space-y-1.5 text-xs">{d.activity.map((a, i) => <li key={i}><span className="text-muted">{relTime(a.created_at)}</span> · {a.actor_label ?? "system"} · <strong>{a.action}</strong></li>)}</ul>
          </Panel>
        </div>
      </div>
      {d.vr && d.vr.byStatus.length > 0 && (
        <Panel title="eTIMS this period" className="mt-6">
          <Table head={["Status", "Invoices", "Amount"]}>{d.vr.byStatus.map((s) => <tr key={s.status}><td className="px-3 py-2 capitalize">{s.status.replace("_", " ")}</td><td className="px-3 py-2">{s.count}</td><td className="px-3 py-2">{formatMoney(s.amount)}</td></tr>)}</Table>
        </Panel>
      )}
    </>
  );
}
