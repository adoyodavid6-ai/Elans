import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { createPartnerWorkspace, updatePartner } from "@/app/ops/console-actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { Select, SubmitButton, Textarea } from "@/components/app/Form";
import { EmptyState } from "@/components/ui/primitives";

type Props = { searchParams: Promise<{ status?: string }> };
const STATUSES = [
  { key: "applied", label: "Applied", tone: "info" },
  { key: "in_review", label: "In review", tone: "warn" },
  { key: "approved", label: "Approved", tone: "good" },
  { key: "active", label: "Active", tone: "good" },
  { key: "paused", label: "Paused", tone: "neutral" },
  { key: "rejected", label: "Rejected", tone: "neutral" },
] as const;

export default async function Partners({ searchParams }: Props) {
  const { status } = await searchParams;
  const u = await requireStaff();
  const canEdit = u.staffRole === "admin" || u.staffRole === "consultant";
  const rows = await asStaff(u, (tx) => tx<{ id: string; name: string; programme: string; status: string; contact_email: string | null; notes: string | null; partner_tenant_id: string | null; created_at: Date; updated_at: Date }[]>`
    select id, name, programme, status, contact_email, notes, partner_tenant_id, created_at, updated_at from partners order by case status when 'applied' then 0 when 'in_review' then 1 else 2 end, created_at desc`);
  const shown = rows.filter((r) => !status || r.status === status);
  const st = (k: string) => STATUSES.find((s) => s.key === k) ?? { key: k, label: k, tone: "neutral" };
  return (
    <>
      <PageTitle title="Partners" description="Referral and white-label applications from the Partners page. Review each one, record notes, and create a partner workspace for approved white-label partners." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/ops/partners" className={`rounded-full px-3 py-1.5 text-sm font-medium ${!status ? "bg-brown text-white" : "bg-surface-2"}`}>All <span className="opacity-70">{rows.length}</span></Link>
        {STATUSES.map((s) => <Link key={s.key} href={`/ops/partners?status=${s.key}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === s.key ? "bg-brown text-white" : "bg-surface-2"}`}>{s.label} <span className="opacity-70">{rows.filter((r) => r.status === s.key).length}</span></Link>)}
      </div>
      {shown.length === 0 ? <Panel><EmptyState icon="globe" title={rows.length ? "No partners with this status" : "No partner applications yet"}>Applications from the website&apos;s Partners page appear here.</EmptyState></Panel> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((p) => (
            <Panel key={p.id} title={<span className="flex flex-wrap items-center gap-2">{p.name} <Badge tone="brand">{p.programme === "white_label" ? "white-label" : "referral"}</Badge></span>} actions={<Badge tone={st(p.status).tone}>{st(p.status).label}</Badge>}>
              <p className="text-sm text-muted">{p.contact_email ?? "No contact email"} · applied {relTime(p.created_at)}{p.updated_at > p.created_at ? ` · updated ${relTime(p.updated_at)}` : ""}</p>
              {p.partner_tenant_id && <p className="mt-2 text-sm"><Badge tone="good">Workspace created</Badge> <Link href={`/ops/clients/${p.partner_tenant_id}`} className="text-copper-ink underline">Open workspace</Link></p>}
              {canEdit ? (
                <form action={updatePartner.bind(null, p.id)} className="mt-4 space-y-3">
                  <div className="text-sm"><label htmlFor={`ps-${p.id}`} className="mb-1 block font-medium">Status</label>
                    <Select id={`ps-${p.id}`} name="status" defaultValue={p.status}>{STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
                  </div>
                  <label className="block text-sm"><span className="mb-1 block font-medium">Notes</span><Textarea name="notes" defaultValue={p.notes ?? ""} placeholder="Due diligence, commercial terms, contacts…" /></label>
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton>Save</SubmitButton>
                    {p.programme === "white_label" && !p.partner_tenant_id && u.staffRole === "admin" && <SubmitButton formAction={createPartnerWorkspace.bind(null, p.id)} tone="secondary" pendingText="Creating…">Create partner workspace</SubmitButton>}
                  </div>
                </form>
              ) : p.notes ? <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{p.notes}</p> : null}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
