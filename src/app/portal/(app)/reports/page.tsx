import { portal } from "@/lib/portal";
import { PageTitle, Panel, Table } from "@/components/app/AppShell";
import { PrintButton } from "@/components/assessment/PrintButton";
import { formatMoney, formatNumber, formatPct } from "@/lib/core/money";
import { varianceReport } from "@/lib/solutions/etims/workflow";

type Props = { searchParams: Promise<{ month?: string }> };

/** Monthly performance report: what ran, what it changed against baseline, what people decided, and what it cost. */
export default async function Reports({ searchParams }: Props) {
  const { month: m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : new Date().toISOString().slice(0, 7);
  const start = `${month}-01`;
  const c = await portal();
  const d = await c.db(async (tx) => {
    const instances = await tx<{ id: string; name: string; solution_slug: string; owner_metric: string; baseline_value: number | null; baseline_note: string | null; config: Record<string, unknown> }[]>`select id, name, solution_slug, owner_metric, baseline_value, baseline_note, config from engine_instances order by created_at`;
    const runs = await tx<{ engine_instance_id: string; total: number; ok: number; failed: number; cost: number }[]>`
      select engine_instance_id, count(*)::int as total, count(*) filter (where status = 'succeeded')::int as ok, count(*) filter (where status = 'failed')::int as failed, coalesce(sum(cost),0)::float as cost
      from runs where started_at >= ${start}::date and started_at < (${start}::date + interval '1 month') group by engine_instance_id`;
    const usage = await tx<{ meter: string; q: number }[]>`select meter, sum(quantity)::float as q from usage_events where created_at >= ${start}::date and created_at < (${start}::date + interval '1 month') group by meter order by meter`;
    const [decisions] = await tx<{ approved: number; rejected: number; reviews: number }[]>`
      select (select count(*)::int from approvals where status = 'approved' and decided_at >= ${start}::date and decided_at < (${start}::date + interval '1 month')) as approved,
        (select count(*)::int from approvals where status = 'rejected' and decided_at >= ${start}::date and decided_at < (${start}::date + interval '1 month')) as rejected,
        (select count(*)::int from review_items where status = 'resolved' and decided_at >= ${start}::date and decided_at < (${start}::date + interval '1 month')) as reviews`;
    const [recon] = await tx<{ total: number; auto: number; amount: number }[]>`select count(*)::int as total, count(*) filter (where match_method = 'auto')::int as auto, coalesce(sum(amount) filter (where status = 'matched'),0)::float as amount from recon_transactions`;
    const [conv] = await tx<{ total: number; resolved: number; handed: number }[]>`select count(*)::int as total, count(*) filter (where resolution = 'resolved')::int as resolved, count(*) filter (where resolution = 'handed_off')::int as handed from conversations`;
    const [inc] = await tx<{ n: number }[]>`select count(*)::int as n from incidents where opened_at >= ${start}::date and opened_at < (${start}::date + interval '1 month')`;
    const etims = instances.find((i) => i.solution_slug === "etims-compliance-reconciliation");
    const vr = etims ? await varianceReport(tx, etims.id, String(etims.config.period ?? month)) : null;
    return { instances, runs, usage, decisions, recon, conv, inc: inc.n, vr };
  });
  const docPages = d.usage.find((u) => u.meter === "doc_page")?.q ?? 0;
  const txns = d.usage.find((u) => u.meter === "txn_reconciled")?.q ?? 0;
  const hours = (docPages * 4 + txns * 3) / 60;
  const label = new Date(`${start}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return (
    <>
      <PageTitle title={`Monthly performance report · ${label}`} description={`${c.tenantName}. Prepared from the run ledger, usage meters and decisions recorded in Elans.`} actions={<span className="no-print flex items-center gap-2"><form className="flex gap-2"><label htmlFor="month" className="sr-only">Month</label><input id="month" type="month" name="month" defaultValue={month} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" /><button className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line">Show</button></form><PrintButton label="Print / PDF" /></span>} />
      {c.isDemo && <p className="mb-4 rounded-xl bg-info-bg p-3 text-sm text-info">Illustrative example: every number on this report comes from synthetic demo data.</p>}
      <div className="space-y-6">
        <Panel title="Summary">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>{d.runs.reduce((s, r) => s + r.total, 0)} automation runs; {d.runs.reduce((s, r) => s + r.failed, 0)} failed; {d.inc} incident{d.inc === 1 ? "" : "s"} opened.</li>
            <li>People made {d.decisions.approved + d.decisions.rejected} approval decisions ({d.decisions.approved} approved, {d.decisions.rejected} rejected) and resolved {d.decisions.reviews} review items.</li>
            {d.vr && <li>eTIMS ({d.vr.period}): {formatPct(d.vr.pctSupported)} of claimed input VAT value supported by valid invoices; {formatMoney(d.vr.atRisk)} at risk across {d.vr.suppliers.filter((s) => s.status !== "ok").length} suppliers.</li>}
            {d.recon.total > 0 && <li>Reconciliation: {formatPct(d.recon.auto / d.recon.total)} of {d.recon.total} payments matched automatically; {formatMoney(d.recon.amount)} allocated.</li>}
            {d.conv.total > 0 && <li>WhatsApp agent: {d.conv.resolved} of {d.conv.total} conversations resolved without a person; {d.conv.handed} handed to your team.</li>}
            <li>Estimated labour capacity released: {formatNumber(hours, 1)} hours (estimate: 4 min per document and 3 min per transaction, from the Diagnostic; capacity, not cash).</li>
          </ul>
        </Panel>
        <Panel title="Owner metrics against baseline">
          <Table head={["Automation", "Owner metric", "Baseline", "Runs", "Model cost (USD)"]}>
            {d.instances.map((i) => { const r = d.runs.find((x) => x.engine_instance_id === i.id); return (
              <tr key={i.id}><td className="px-3 py-2 font-medium">{i.name}</td><td className="px-3 py-2 text-sm">{i.owner_metric}</td><td className="px-3 py-2 text-sm">{i.baseline_value !== null ? `${i.baseline_value}% (${i.baseline_note})` : "not recorded"}</td><td className="px-3 py-2">{r?.total ?? 0}</td><td className="px-3 py-2">{(r?.cost ?? 0).toFixed(4)}</td></tr>
            ); })}
          </Table>
        </Panel>
        <Panel title="Usage meters">
          <Table head={["Meter", "Quantity"]} empty="No usage recorded this month">{d.usage.map((u) => <tr key={u.meter}><td className="px-3 py-2">{u.meter.replace(/_/g, " ")}</td><td className="px-3 py-2">{formatNumber(u.q)}</td></tr>)}</Table>
        </Panel>
        <p className="text-xs text-muted">Notes: &quot;Estimate&quot; figures are calculated from inputs agreed in the Diagnostic and are not audited. Model costs are metered per call. Questions about this report: raise a support ticket.</p>
      </div>
    </>
  );
}
