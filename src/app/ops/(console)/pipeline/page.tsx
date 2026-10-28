import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, OPP_STAGES, relTime } from "@/lib/ops/data";
import { moveOpportunity } from "@/app/ops/actions";
import { formatMoney } from "@/lib/core/money";
import { PageTitle } from "@/components/app/AppShell";

export default async function Pipeline() {
  const u = await requireStaff();
  const opps = await asStaff(u, (tx) => tx<{ id: string; name: string; stage: string; value: number; updated_at: Date; organisation: string | null }[]>`
    select o.id, o.name, o.stage, o.value, o.updated_at, c.organisation from opportunities o left join leads l on l.id = o.lead_id left join contacts c on c.id = l.contact_id order by o.updated_at desc`);
  return (
    <>
      <PageTitle title="Pipeline" description="Opportunities by Elans Method stage. Move a card with its stage menu." />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {OPP_STAGES.map((s) => {
          const list = opps.filter((o) => o.stage === s.key);
          const total = list.reduce((a, o) => a + Number(o.value), 0);
          return (
            <section key={s.key} aria-label={s.label} className="w-72 shrink-0 rounded-2xl border border-line bg-surface-2/60 p-3">
              <header className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="font-semibold text-heading">{s.label} <span className="text-muted">{list.length}</span></h2>
                <span className="text-xs text-muted">{formatMoney(total, "KES", { compact: true })}</span>
              </header>
              <ul className="space-y-2">
                {list.map((o) => (
                  <li key={o.id} className="rounded-xl border border-line bg-surface p-3 shadow-sm">
                    <Link href={`/ops/opportunities/${o.id}`} className="font-medium text-heading hover:underline">{o.name}</Link>
                    <p className="text-xs text-muted">{o.organisation} · {relTime(o.updated_at)}</p>
                    <p className="mt-1 text-sm font-semibold">{formatMoney(Number(o.value))}</p>
                    <form action={async (fd: FormData) => { "use server"; await moveOpportunity(o.id, String(fd.get("stage"))); }} className="mt-2 flex gap-1">
                      <label className="sr-only" htmlFor={`st-${o.id}`}>Stage</label>
                      <select id={`st-${o.id}`} name="stage" defaultValue={o.stage} className="h-8 flex-1 rounded-lg border border-line bg-surface px-1 text-xs">{OPP_STAGES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
                      <button className="rounded-lg bg-surface-2 px-2 text-xs font-semibold ring-1 ring-line">Move</button>
                    </form>
                  </li>
                ))}
                {list.length === 0 && <li className="px-1 text-xs text-muted">Nothing here.</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
