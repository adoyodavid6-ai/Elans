import Link from "next/link";
import type { PortalCtx } from "@/lib/portal";
import { importStatementCsv } from "@/app/portal/actions";
import { Badge, Kpi, Panel, Table } from "@/components/app/AppShell";
import { formatMoney, formatPct } from "@/lib/core/money";

const SAMPLE = `txnRef,txnAt,amount,payerName,payerPhone,reference
TJK4X81QZP,2026-10-27T09:14:00+03:00,12500,JANE WANJIRU,254712000111,INV-1042
TJK4X93LMA,2026-10-27T10:02:00+03:00,8000,PETER OTIENO,254722000222,peter shop`;

export async function ReconWorkspace({ ctx, instanceId }: { ctx: PortalCtx; instanceId: string }) {
  const d = await ctx.db(async (tx) => {
    const receivables = await tx<{ id: string; number: string; customer_name: string; account_ref: string | null; amount: number; balance: number; due_date: string | null; status: string }[]>`
      select id, number, customer_name, account_ref, amount, balance, due_date::text, status from recon_receivables where engine_instance_id = ${instanceId} order by status, due_date nulls last limit 200`;
    const txns = await tx<{ id: string; txn_ref: string; txn_at: Date; amount: number; payer_name: string | null; reference: string | null; status: string; match_method: string | null; confidence: number | null; receipted_at: Date | null; number: string | null }[]>`
      select t.id, t.txn_ref, t.txn_at, t.amount, t.payer_name, t.reference, t.status, t.match_method, t.confidence, t.receipted_at, r.number
      from recon_transactions t left join recon_receivables r on r.id = t.receivable_id where t.engine_instance_id = ${instanceId} order by t.txn_at desc limit 200`;
    const [open] = await tx<{ n: number }[]>`select count(*)::int as n from review_items where engine_instance_id = ${instanceId} and status = 'open'`;
    return { receivables, txns, openReviews: open.n };
  });
  const matched = d.txns.filter((t) => t.status === "matched");
  const auto = matched.filter((t) => t.match_method === "auto").length;
  const outstanding = d.receivables.reduce((s, r) => s + Number(r.balance), 0);
  return (
    <div className="space-y-6">
      {ctx.isDemo && <p className="rounded-xl bg-info-bg p-3 text-sm text-info">Illustrative example: customers, invoices and M-Pesa transactions here are synthetic.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Transactions imported" value={d.txns.length} />
        <Kpi label="Matched automatically" value={d.txns.length ? formatPct(auto / d.txns.length) : "—"} hint={`${auto} of ${d.txns.length}`} tone="good" />
        <Kpi label="Waiting for you" value={d.openReviews} hint="unclear payments to confirm" href="/portal/approvals" tone={d.openReviews ? "warn" : undefined} />
        <Kpi label="Outstanding receivables" value={formatMoney(outstanding, "KES", { compact: true })} />
      </div>
      <Panel title="Import a statement">
        <p className="text-sm text-muted">Paste an M-Pesa or bank statement export as CSV with the columns shown. Re-importing the same rows is safe: duplicates are skipped by transaction reference.</p>
        <form action={importStatementCsv.bind(null, instanceId)} className="mt-3 space-y-2">
          <label htmlFor="csv" className="sr-only">Statement CSV</label>
          <textarea id="csv" name="csv" rows={5} defaultValue={SAMPLE} className="w-full rounded-lg border border-line bg-surface p-2 font-mono text-xs" />
          <button className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Import & match</button>
        </form>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Transactions">
          <Table head={["Ref", "Amount", "Payer / reference", "Result"]} empty="No transactions imported yet">
            {d.txns.map((t) => (
              <tr key={t.id} className="align-top">
                <td className="px-3 py-2 font-mono text-xs">{t.txn_ref}<br /><span className="text-muted">{t.txn_at.toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi" })}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{formatMoney(Number(t.amount))}</td>
                <td className="px-3 py-2 text-xs">{t.payer_name ?? "—"}<br /><span className="text-muted">{t.reference ?? ""}</span></td>
                <td className="px-3 py-2">
                  <Badge tone={t.status === "matched" ? "good" : t.status === "suggested" ? "warn" : t.status === "ignored" ? "neutral" : "bad"}>{t.status}</Badge>
                  {t.number && <p className="text-xs text-muted">→ {t.number} ({t.match_method}{t.confidence !== null ? ` ${Number(t.confidence).toFixed(2)}` : ""})</p>}
                  {t.receipted_at && <p className="text-xs text-success">receipt sent</p>}
                </td>
              </tr>
            ))}
          </Table>
          {d.openReviews > 0 && <Link href="/portal/approvals" className="mt-3 inline-block text-sm font-semibold text-copper-ink underline">Confirm {d.openReviews} unclear payments</Link>}
        </Panel>
        <Panel title="Receivables">
          <Table head={["Invoice", "Customer", "Balance", "Status"]} empty="No receivables loaded">
            {d.receivables.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-xs">{r.number}<br /><span className="text-muted">acct {r.account_ref ?? "—"}</span></td>
                <td className="px-3 py-2">{r.customer_name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatMoney(Number(r.balance))}<br /><span className="text-xs text-muted">of {formatMoney(Number(r.amount))}</span></td>
                <td className="px-3 py-2"><Badge tone={r.status === "paid" ? "good" : r.status === "part_paid" ? "warn" : "neutral"}>{r.status.replace("_", " ")}</Badge></td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </div>
  );
}
