import Link from "next/link";
import { portal } from "@/lib/portal";
import { createDpaRequest, setAccountKillSwitch } from "@/app/portal/actions";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";

export default async function Privacy() {
  const c = await portal();
  const d = await c.db(async (tx) => ({
    holdings: await tx<{ label: string; n: number }[]>`
      select 'Conversations' as label, count(*)::int as n from conversations union all
      select 'Messages', count(*)::int from messages union all
      select 'Purchase invoices (eTIMS)', count(*)::int from etims_invoices union all
      select 'Customer receivables', count(*)::int from recon_receivables union all
      select 'Payment transactions', count(*)::int from recon_transactions union all
      select 'Documents', count(*)::int from documents union all
      select 'Audit entries', count(*)::int from audit_log`,
    requests: await tx<{ id: string; subject_ref: string; type: string; status: string; received_at: Date; due_at: Date }[]>`select id, subject_ref, type, status, received_at, due_at from dpa_requests order by received_at desc limit 50`,
    audit: await tx<{ actor_label: string | null; action: string; entity: string | null; created_at: Date }[]>`select actor_label, action, entity, created_at from audit_log order by created_at desc limit 40`,
    tenant: (await tx<{ kill_switch: boolean }[]>`select kill_switch from tenants where id = app_tenant()`)[0],
  }));
  return (
    <>
      <PageTitle title="Data & Privacy" description="What Elans holds for you, who touched it, and your controls under the Kenya Data Protection Act 2019. Elans acts as your data processor; your data is never used to train AI models." actions={<a href="/portal/export" className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Export all data (JSON)</a>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="What we hold">
          <Table head={["Record type", "Count"]}>{d.holdings.map((h) => <tr key={h.label}><td className="px-3 py-2">{h.label}</td><td className="px-3 py-2">{h.n.toLocaleString("en-GB")}</td></tr>)}</Table>
          <p className="mt-3 text-xs text-muted">Retention follows your agreement (default: operational records for the contract term plus 7 years where tax law requires; conversations 12 months). See the <Link href="/legal/dpa" className="underline">data processing terms</Link>.</p>
        </Panel>
        <Panel title="Account kill switch">
          <p className="text-sm text-muted">Stops every automation on your account immediately. Incoming work is still recorded. Owner only.</p>
          <form action={setAccountKillSwitch.bind(null, !d.tenant.kill_switch)} className="mt-4">
            <button disabled={c.role !== "owner" && !c.isDemo} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${d.tenant.kill_switch ? "bg-success" : "bg-danger"}`}>{d.tenant.kill_switch ? "Resume all automations" : "Stop all automations now"}</button>
          </form>
        </Panel>
        <Panel title="Data subject requests">
          <form action={createDpaRequest} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <label htmlFor="subject" className="sr-only">Person (name, phone or email)</label>
            <input id="subject" name="subject" required placeholder="Person's name, phone or email" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
            <label htmlFor="type" className="sr-only">Request type</label>
            <select id="type" name="type" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"><option value="access">Access</option><option value="correction">Correction</option><option value="erasure">Erasure</option><option value="objection">Objection</option><option value="export">Export</option></select>
            <button className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Log request</button>
          </form>
          <div className="mt-4"><Table head={["Person", "Type", "Status", "Due"]} empty="No requests logged">{d.requests.map((r) => <tr key={r.id}><td className="px-3 py-2">{r.subject_ref}</td><td className="px-3 py-2 capitalize">{r.type}</td><td className="px-3 py-2"><Badge tone={r.status === "completed" ? "good" : "warn"}>{r.status.replace("_", " ")}</Badge></td><td className="px-3 py-2 text-xs">{relTime(r.due_at)}</td></tr>)}</Table></div>
        </Panel>
        <Panel title="Audit log (latest 40)">
          <ul className="max-h-96 space-y-1 overflow-auto text-xs">{d.audit.map((a, i) => <li key={i}><span className="text-muted">{a.created_at.toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })}</span> · {a.actor_label ?? "system"} · <strong>{a.action}</strong>{a.entity ? ` (${a.entity})` : ""}</li>)}</ul>
          <p className="mt-3 text-xs text-muted">Elans staff can only open your workspace through a time-limited, logged access grant; those grants appear here.</p>
        </Panel>
      </div>
    </>
  );
}
