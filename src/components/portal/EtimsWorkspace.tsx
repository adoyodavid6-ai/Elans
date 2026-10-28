import Link from "next/link";
import type { PortalCtx } from "@/lib/portal";
import { varianceReport, type EtimsConfig } from "@/lib/solutions/etims/workflow";
import { simulateInvoiceIntake, uploadInvoices } from "@/app/portal/actions";
import { Badge, Kpi, Panel, Table } from "@/components/app/AppShell";
import { formatMoney, formatPct } from "@/lib/core/money";
import { relTime } from "@/lib/ops/data";
import { PrintButton } from "@/components/assessment/PrintButton";

const STATUS: Record<string, { label: string; tone: string; help: string }> = {
  valid: { label: "Valid in eTIMS", tone: "good", help: "Found in eTIMS, PIN and amount agree" },
  pending_check: { label: "Checking", tone: "info", help: "Waiting for the eTIMS check" },
  needs_review: { label: "Being checked by a person", tone: "warn", help: "A field was unclear; an Elans reviewer confirms it" },
  invalid: { label: "Invalid", tone: "bad", help: "Not a valid eTIMS invoice for your PIN" },
  not_found: { label: "Not found in eTIMS", tone: "bad", help: "The control unit number does not exist in eTIMS" },
  mismatch: { label: "Mismatch", tone: "bad", help: "eTIMS record differs (PIN or amount)" },
  duplicate: { label: "Duplicate", tone: "neutral", help: "Same supplier and invoice number already processed" },
};

export async function EtimsWorkspace({ ctx, instanceId }: { ctx: PortalCtx; instanceId: string }) {
  const d = await ctx.db(async (tx) => {
    const [inst] = await tx<{ config: EtimsConfig }[]>`select config from engine_instances where id = ${instanceId}`;
    const cfg = inst.config;
    const report = await varianceReport(tx, instanceId, cfg.period);
    const invoices = await tx<{ id: string; source: string; supplier_name: string | null; supplier_pin: string | null; invoice_no: string | null; cu_invoice_no: string | null; invoice_date: string | null; amount_total: number | null; field_confidence: Record<string, number>; status: string; reason: string | null; run_id: string | null; created_at: Date }[]>`
      select id, source, supplier_name, supplier_pin, invoice_no, cu_invoice_no, invoice_date::text, amount_total, field_confidence, status, reason, run_id, created_at from etims_invoices where engine_instance_id = ${instanceId} order by created_at desc limit 200`;
    const [pending] = await tx<{ n: number }[]>`select count(*)::int as n from approvals where engine_instance_id = ${instanceId} and status = 'pending'`;
    return { cfg, report, invoices, pendingApprovals: pending.n };
  });
  const { report, cfg } = d;
  const minConf = (c: Record<string, number>) => {
    const v = Object.entries(c).filter(([k]) => k !== "vatAmount" && k !== "cuInvoiceNo").map(([, x]) => x);
    return v.length ? Math.min(...v) : 0;
  };
  return (
    <div className="space-y-6">
      {ctx.isDemo && <p className="rounded-xl bg-info-bg p-3 text-sm text-info">Illustrative example: the invoices below are synthetic samples generated for this demo and checked against a mock eTIMS service. No real supplier or KRA data is used.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={`Input VAT invoices (${report.period})`} value={report.invoices} hint="excluding duplicates" />
        <Kpi label="Claimed value" value={formatMoney(report.claimed, "KES", { compact: true })} />
        <Kpi label="Supported by valid eTIMS" value={formatPct(report.pctSupported)} hint={formatMoney(report.validAmount, "KES", { compact: true })} tone={report.pctSupported >= 0.9 ? "good" : "warn"} />
        <Kpi label="Value at risk" value={formatMoney(report.atRisk, "KES", { compact: true })} hint={`${d.pendingApprovals} supplier requests awaiting approval`} href="/portal/approvals" tone={report.atRisk > 0 ? "bad" : "good"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Send invoices in">
          <p className="text-sm text-muted">Upload PDFs, photos or text files (up to 10 at a time, 5 MB each). In production, suppliers&apos; invoices also arrive by forwarding to your WhatsApp intake number or email address.</p>
          <form action={uploadInvoices.bind(null, instanceId)} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="file" name="files" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" aria-label="Invoice files" className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-semibold" />
            <button className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Upload & process</button>
          </form>
          <details className="mt-4 rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-semibold">Simulate a WhatsApp forward</summary>
            <form action={simulateInvoiceIntake.bind(null, instanceId)} className="mt-3 space-y-2">
              <label className="block text-xs text-muted" htmlFor="wa-text">Paste invoice text, or leave blank to use the next synthetic sample.</label>
              <textarea id="wa-text" name="text" rows={4} className="w-full rounded-lg border border-line bg-surface p-2 text-sm" placeholder="TAX INVOICE&#10;Supplier: … PIN: P0…" />
              <button className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold ring-1 ring-line">Send to intake</button>
            </form>
          </details>
        </Panel>
        <Panel title="How the check works">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>Fields are read from the invoice (supplier PIN, CU number, date, totals). Each field gets a confidence score.</li>
            <li>Any field below {formatPct(cfg.threshold)} confidence goes to an Elans reviewer before anything else happens.</li>
            <li>Rules check your buyer PIN ({cfg.buyerPin}) and duplicates.</li>
            <li>The CU number is checked in eTIMS (currently the mock service; live once KRA access is configured).</li>
            <li>For anything not valid, a correction request to the supplier is drafted and waits for your approval.</li>
          </ol>
        </Panel>
      </div>

      <Panel title={`VAT variance report · ${report.period}`} actions={<span className="no-print"><PrintButton label="Print / PDF" /></span>}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">By status</h3>
            <Table head={["Status", "Invoices", "Amount"]}>
              {report.byStatus.map((s) => (
                <tr key={s.status}><td className="px-3 py-2"><Badge tone={STATUS[s.status]?.tone}>{STATUS[s.status]?.label ?? s.status}</Badge></td><td className="px-3 py-2">{s.count}</td><td className="px-3 py-2">{formatMoney(s.amount)}</td></tr>
              ))}
            </Table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Supplier register</h3>
            <Table head={["Supplier", "Invoices", "Not valid", "At risk", "Status"]} empty="No suppliers yet">
              {report.suppliers.slice(0, 12).map((s) => (
                <tr key={s.pin}><td className="px-3 py-2"><p className="font-medium">{s.name ?? "—"}</p><p className="font-mono text-xs text-muted">{s.pin}</p></td><td className="px-3 py-2">{s.invoices}</td><td className="px-3 py-2">{s.invalid}</td><td className="px-3 py-2">{formatMoney(s.atRisk)}</td><td className="px-3 py-2"><Badge tone={s.status === "ok" ? "good" : s.status === "watch" ? "warn" : "bad"}>{s.status.replace("_", " ")}</Badge></td></tr>
              ))}
            </Table>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">This report supports, but does not replace, your tax adviser&apos;s review. Statuses reflect the eTIMS check at the time shown.</p>
      </Panel>

      <Panel title="Invoices">
        <Table head={["Received", "Supplier", "Invoice / CU no.", "Amount", "Lowest field confidence", "Status", ""]} empty="No invoices yet. Upload one above.">
          {d.invoices.map((i) => (
            <tr key={i.id} className="align-top hover:bg-surface-2">
              <td className="px-3 py-2 text-xs text-muted">{relTime(i.created_at)}<br />{i.source}</td>
              <td className="px-3 py-2"><p className="font-medium">{i.supplier_name ?? "—"}</p><p className="font-mono text-xs text-muted">{i.supplier_pin ?? "no PIN"}</p></td>
              <td className="px-3 py-2"><p>{i.invoice_no ?? "—"}</p><p className="font-mono text-xs text-muted">{i.cu_invoice_no ?? "no CU number"}</p></td>
              <td className="px-3 py-2 whitespace-nowrap">{i.amount_total !== null ? formatMoney(Number(i.amount_total)) : "—"}</td>
              <td className="px-3 py-2"><span className={minConf(i.field_confidence) < cfg.threshold ? "text-warning font-semibold" : ""}>{minConf(i.field_confidence).toFixed(2)}</span></td>
              <td className="px-3 py-2"><Badge tone={STATUS[i.status]?.tone}>{STATUS[i.status]?.label ?? i.status}</Badge>{i.reason && <p className="mt-1 max-w-xs text-xs text-muted">{i.reason}</p>}</td>
              <td className="px-3 py-2">{i.run_id && <Link href={`/portal/runs/${i.run_id}`} className="text-xs text-copper-ink underline">Audit trail</Link>}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
