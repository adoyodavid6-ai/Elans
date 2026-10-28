import { requireStaff } from "@/lib/auth";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { savePrices } from "@/app/ops/cms-actions";
import { PageTitle, Panel, Badge } from "@/components/app/AppShell";

export default async function Prices() {
  const u = await requireStaff();
  const rows = await withDb({ tenantId: INTERNAL_TENANT_ID, userId: u.id }, (tx) => tx<{ key: string; label: string; amount: number | null; currency: string; token: string; confirmed: boolean; updated_by: string | null }[]>`select key, label, amount, currency, token, confirmed, updated_by from price_points order by key`);
  const admin = u.staffRole === "admin";
  return (
    <>
      <PageTitle title="Prices" description="Every price on the site comes from here. Unconfirmed prices show an 'Indicative' tag. Tick 'Confirmed' once David approves a figure (and update PLACEHOLDERS.md)." />
      <Panel>
        <form action={savePrices}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">Price point</th><th>Token</th><th className="w-44">Amount (major units)</th><th>Confirmed</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2.5"><p className="font-medium">{r.label}</p><p className="font-mono text-xs text-muted">{r.key}</p></td>
                    <td className="font-mono text-xs text-muted">{r.token}</td>
                    <td><div className="flex items-center gap-2"><span className="text-xs text-muted">{r.currency}</span><input name={`amount:${r.key}`} defaultValue={r.amount ?? ""} placeholder="Quoted" disabled={!admin} aria-label={`${r.label} amount`} className="h-9 w-32 rounded-lg border border-line bg-surface px-2" /></div></td>
                    <td><label className="flex items-center gap-2"><input type="checkbox" name={`confirmed:${r.key}`} defaultChecked={r.confirmed} disabled={!admin} className="h-4 w-4 accent-[#6B4936]" />{r.confirmed ? <Badge tone="good">confirmed</Badge> : <Badge tone="warn">indicative</Badge>}</label></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {admin ? <button className="mt-4 rounded-lg bg-brown px-5 py-2 text-sm font-semibold text-white">Save prices</button> : <p className="mt-4 text-sm text-muted">Only admins can change prices.</p>}
        </form>
      </Panel>
    </>
  );
}
