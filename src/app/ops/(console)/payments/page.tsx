import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { mpesaConfigStatus } from "@/lib/integrations/mpesa";
import { paystackConfigStatus } from "@/lib/integrations/paystack";
import { c2bUrls, checkPayment, registerMpesaC2b, testProvider } from "@/app/ops/payment-actions";
import { formatMoney } from "@/lib/core/money";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/Form";
import { CopyLink } from "@/components/documents/CopyLink";
import { Icon } from "@/components/ui/Icon";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const MODE_TONE: Record<string, string> = { mock: "warn", sandbox: "info", production: "good", off: "neutral", test: "info", live: "good" };
const MODE_LABEL: Record<string, string> = { mock: "Test mode (no money moves)", sandbox: "Sandbox", production: "Live", off: "Not set up", test: "Test keys", live: "Live" };

export default async function Payments() {
  const u = await requireStaff(["admin", "consultant"]);
  const isAdmin = u.staffRole === "admin";
  const m = mpesaConfigStatus();
  const ps = paystackConfigStatus();
  const urls = isAdmin ? await c2bUrls() : null;
  const rows = await asStaff(u, (tx) => tx<{ id: string; tenant_name: string; provider: string; purpose: string; reference: string; amount: number; currency: string; status: string; provider_ref: string | null; created_at: Date }[]>`select id, tenant_name, provider, purpose, reference, amount, currency, status, provider_ref, created_at from ops_payment_queue(100)`);
  const Vars = ({ vars }: { vars: { key: string; set: boolean; optional: boolean }[] }) => (
    <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
      {vars.map((v) => <li key={v.key} className="flex items-center gap-2"><Icon name={v.set ? "check" : "x"} size={15} className={v.set ? "text-success" : v.optional ? "text-muted" : "text-danger"} /><code className="text-xs">{v.key}</code>{v.optional && <span className="text-xs text-muted">optional</span>}</li>)}
    </ul>
  );
  return (
    <>
      <PageTitle title="Payments" description="M-Pesa and Paystack set-up and every payment across sessions and client invoices. Keys are added as environment variables in Vercel (never stored in the database); this page only shows whether each one is present." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2">M-Pesa (Daraja) <Badge tone={MODE_TONE[m.mode]}>{MODE_LABEL[m.mode]}</Badge></span>}>
          <p className="text-sm text-muted">STK push to the customer&apos;s phone for sessions and invoices; payments made straight to your {m.type.toLowerCase()} are recorded and matched to invoices by account number.</p>
          {m.missing.length > 0 && <p className="mt-3 rounded-lg bg-warning-bg p-2.5 text-sm text-warning">MPESA_ENV is set to {m.requested} but these are missing, so M-Pesa is still in test mode: {m.missing.join(", ")}.</p>}
          <Vars vars={[{ key: "MPESA_ENV", set: m.requested !== "mock", optional: false }, ...m.vars]} />
          <p className="mt-3 text-xs text-muted">Payment type: <strong>{m.type}</strong>{m.type === "Paybill" ? " (set MPESA_TILL_NUMBER for Buy Goods)." : "."}</p>
          {isAdmin && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <form action={testProvider.bind(null, "mpesa")}><SubmitButton tone="secondary" pendingText="Testing…">Test connection</SubmitButton></form>
                <form action={registerMpesaC2b}><SubmitButton tone="secondary" pendingText="Registering…" disabled={m.mode === "mock"}>Register paybill/till confirmation URLs</SubmitButton></form>
              </div>
              {urls && (
                <details className="rounded-xl border border-line p-3 text-sm">
                  <summary className="cursor-pointer font-semibold">Addresses for Safaricom (if registering manually)</summary>
                  <p className="mt-2 text-xs text-muted">STK callbacks are set automatically on each payment. For payments made from the phone menu, register these (the button above does it for you):</p>
                  <p className="mt-2 text-xs font-medium">Confirmation URL</p><CopyLink url={urls.confirmation} />
                  <p className="mt-2 text-xs font-medium">Validation URL</p><CopyLink url={urls.validation} />
                </details>
              )}
            </div>
          )}
        </Panel>

        <Panel title={<span className="flex items-center gap-2">Paystack <Badge tone={MODE_TONE[ps.mode]}>{MODE_LABEL[ps.mode]}</Badge></span>}>
          <p className="text-sm text-muted">Cards (Visa, Mastercard), and M-Pesa or bank transfer through Paystack&apos;s secure checkout. Customers are sent to Paystack and come back when done; nothing is marked paid until Paystack confirms the amount.</p>
          <Vars vars={ps.vars} />
          <p className="mt-3 text-xs text-muted">Currency: <strong>{ps.currency}</strong>. Use a <code>sk_test_</code> key to try it, then switch to <code>sk_live_</code>.</p>
          {isAdmin && (
            <div className="mt-4 space-y-3">
              <form action={testProvider.bind(null, "paystack")}><SubmitButton tone="secondary" pendingText="Testing…">Test connection</SubmitButton></form>
              <div className="rounded-xl border border-line p-3 text-sm">
                <p className="font-semibold">Webhook URL for the Paystack dashboard</p>
                <p className="mb-2 text-xs text-muted">Paste into Settings → API Keys &amp; Webhooks → Live (and Test) Webhook URL.</p>
                <CopyLink url={`${site()}/api/webhooks/paystack`} />
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={`Recent payments (${rows.length})`} className="mt-6">
        <Table head={["When", "Account", "For", "Method", "Amount", "Status", "Provider ref", ""]} empty="No payments yet." label="Recent payments">
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-surface-2">
              <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{relTime(p.created_at)}</td>
              <td className="px-3 py-2">{p.tenant_name}</td>
              <td className="px-3 py-2 text-xs"><p>{p.purpose === "c2b" ? "Paid to paybill/till" : p.purpose.replace(":", " · ")}</p><p className="text-muted">{p.reference}</p></td>
              <td className="px-3 py-2 text-xs">{{ mpesa: "M-Pesa STK", mpesa_c2b: "M-Pesa paybill/till", paystack: "Paystack", mock: "Test mode", card: "Card" }[p.provider] ?? p.provider}</td>
              <td className="whitespace-nowrap px-3 py-2">{formatMoney(Number(p.amount), p.currency)}</td>
              <td className="px-3 py-2"><Badge tone={p.status === "succeeded" ? "good" : p.status === "failed" ? "bad" : "warn"}>{p.status}</Badge></td>
              <td className="px-3 py-2 font-mono text-[0.7rem] text-muted">{p.provider_ref?.slice(0, 18)}</td>
              <td className="px-3 py-2">{p.status === "pending" && p.provider !== "mock" && <form action={checkPayment.bind(null, p.id)}><SubmitButton tone="secondary" className="h-7 px-2 text-xs" pendingText="…">Check status</SubmitButton></form>}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
