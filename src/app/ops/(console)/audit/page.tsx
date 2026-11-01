import { requireStaff, requireSuper } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { PageTitle, Panel, Table, Badge } from "@/components/app/AppShell";
import { Input, Select } from "@/components/app/Form";

type Props = { searchParams: Promise<{ actor?: string; action?: string; days?: string }> };

export default async function AuditLog({ searchParams }: Props) {
  const sp = await searchParams;
  const u = await requireSuper();
  const days = [1, 7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const actor = (sp.actor ?? "").slice(0, 80);
  const action = (sp.action ?? "").slice(0, 60);
  const d = await asStaff(u, async (tx) => ({
    rows: await tx<{ id: number; actor_label: string | null; action: string; entity: string | null; entity_id: string | null; meta: Record<string, unknown>; created_at: Date }[]>`
      select id, actor_label, action, entity, entity_id, meta, created_at from audit_log
      where created_at > now() - ${`${days} days`}::interval
        and (${actor} = '' or actor_label ilike ${"%" + actor + "%"})
        and (${action} = '' or action ilike ${action + "%"})
      order by created_at desc limit 300`,
    actions: await tx<{ prefix: string }[]>`select distinct split_part(action, '.', 1) as prefix from audit_log order by 1`,
  }));
  return (
    <>
      <PageTitle title="Audit log" description="Every significant action on the Elans internal account: sign-ins, lead and quote changes, content and price edits, exports and settings. Client-side actions are in each client's own audit log." />
      <Panel>
        <form className="mb-4 flex flex-wrap items-end gap-2">
          <label className="text-sm"><span className="mb-1 block text-muted">Who</span><Input name="actor" defaultValue={actor} placeholder="email or name" className="w-56" /></label>
          <div className="text-sm"><label htmlFor="audit-action" className="mb-1 block text-muted">What</label>
            <Select id="audit-action" name="action" defaultValue={action} className="w-44"><option value="">Any action</option>{d.actions.map((a) => <option key={a.prefix} value={a.prefix}>{a.prefix}</option>)}</Select>
          </div>
          <div className="text-sm"><label htmlFor="audit-days" className="mb-1 block text-muted">When</label>
            <Select id="audit-days" name="days" defaultValue={String(days)} className="w-36"><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></Select>
          </div>
          <button className="h-10 rounded-lg bg-brown px-4 text-sm font-semibold text-white">Apply</button>
        </form>
        <Table head={["When", "Who", "Action", "Item", "Details"]} empty="Nothing recorded for these filters.">
          {d.rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-muted" title={r.created_at.toISOString()}>{relTime(r.created_at)}</td>
              <td className="px-3 py-2 text-sm">{r.actor_label ?? "system"}</td>
              <td className="px-3 py-2"><Badge tone="brand">{r.action}</Badge></td>
              <td className="px-3 py-2 text-xs text-muted">{r.entity ? `${r.entity}${r.entity_id ? ` · ${r.entity_id.slice(0, 18)}` : ""}` : "—"}</td>
              <td className="max-w-xs truncate px-3 py-2 font-mono text-[0.7rem] text-muted">{Object.keys(r.meta ?? {}).length ? JSON.stringify(r.meta) : ""}</td>
            </tr>
          ))}
        </Table>
        {d.rows.length === 300 && <p className="mt-2 text-xs text-muted">Showing the latest 300 entries. Narrow the filters to see older ones.</p>}
      </Panel>
    </>
  );
}
