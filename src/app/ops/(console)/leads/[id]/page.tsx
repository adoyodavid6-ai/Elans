import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { asStaff, LEAD_STAGES, relTime } from "@/lib/ops/data";
import { addLeadNote, createOpportunity, updateLead } from "@/app/ops/actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { Icon } from "@/components/ui/Icon";

type Props = { params: Promise<{ id: string }> };

export default async function LeadDetail({ params }: Props) {
  const { id } = await params;
  const u = await requireStaff();
  const d = await asStaff(u, async (tx) => {
    const [lead] = await tx<{ id: string; contact_id: string; source: string; source_detail: string | null; industry: string | null; score: number; stage: string; message: string | null; owner_id: string | null; utm: Record<string, string>; created_at: Date; lost_reason: string | null }[]>`select * from leads where id = ${id}`;
    if (!lead) return null;
    const [contact] = await tx<{ name: string; email: string; phone: string | null; organisation: string | null; role_title: string | null }[]>`select name, email, phone, organisation, role_title from contacts where id = ${lead.contact_id}`;
    const consents = await tx<{ purpose: string; granted: boolean; notice_version: string; source: string; created_at: Date }[]>`select purpose, granted, notice_version, source, created_at from consents where contact_id = ${lead.contact_id} order by created_at desc`;
    const assessments = await tx<{ id: string; state: string; submitted_at: Date | null; token: string | null }[]>`select a.id, a.state, a.submitted_at, (select public_token from reports r where r.assessment_id = a.id limit 1) as token from assessments a where a.lead_id = ${id}`;
    const bookings = await tx<{ id: string; type: string; starts_at: Date; status: string }[]>`select id, type, starts_at, status from bookings where contact_id = ${lead.contact_id} order by starts_at desc`;
    const roi = await tx<{ calculator: string; created_at: Date }[]>`select calculator, created_at from roi_scenarios where lead_id = ${id}`;
    const notes = await tx<{ author_label: string; body: string; created_at: Date }[]>`select author_label, body, created_at from lead_notes where lead_id = ${id} order by created_at desc`;
    const opps = await tx<{ id: string; name: string; stage: string; value: number }[]>`select id, name, stage, value from opportunities where lead_id = ${id}`;
    const staff = await tx<{ id: string; name: string }[]>`select id, name from ops_staff_directory()`;
    return { lead, contact, consents, assessments, bookings, roi, notes, opps, staff };
  });
  if (!d) notFound();
  const { lead, contact } = d;
  const marketing = d.consents.find((c) => c.purpose === "marketing");
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/leads", label: "Leads" }]} title={contact?.organisation || contact?.name || "Lead"} description={`${contact?.name} · ${contact?.email}${contact?.phone ? ` · ${contact.phone}` : ""}`} actions={<Badge tone="brand">{lead.source}</Badge>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Enquiry">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Source detail</dt><dd className="font-medium">{lead.source_detail ?? "—"}</dd></div>
              <div><dt className="text-muted">Industry</dt><dd className="font-medium">{lead.industry ?? "—"}</dd></div>
              <div><dt className="text-muted">Lead score</dt><dd className="font-medium">{lead.score}</dd></div>
              <div><dt className="text-muted">Created</dt><dd className="font-medium">{relTime(lead.created_at)}</dd></div>
              {Object.keys(lead.utm ?? {}).length > 0 && <div className="sm:col-span-2"><dt className="text-muted">UTM</dt><dd className="font-mono text-xs">{JSON.stringify(lead.utm)}</dd></div>}
            </dl>
            {lead.message && <p className="mt-4 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{lead.message}</p>}
          </Panel>
          <Panel title="Activity">
            <ul className="space-y-3 text-sm">
              {d.assessments.map((a) => (
                <li key={a.id} className="flex items-center gap-2"><Icon name="spark" size={16} className="text-copper" /> Assessment {a.state} {a.submitted_at && relTime(a.submitted_at)} · <Link href={`/ops/assessments/${a.id}`} className="text-copper-ink hover:underline">review</Link>{a.token && <> · <a href={`/assessment/report/${a.token}`} target="_blank" className="text-copper-ink hover:underline">report</a></>}</li>
              ))}
              {d.bookings.map((b) => (
                <li key={b.id} className="flex items-center gap-2"><Icon name="calendar" size={16} className="text-copper" /> <span className="capitalize">{b.type}</span> session {b.starts_at.toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })} · <Badge tone={b.status === "confirmed" ? "good" : "neutral"}>{b.status}</Badge></li>
              ))}
              {d.roi.map((r, i) => (
                <li key={i} className="flex items-center gap-2"><Icon name="calculator" size={16} className="text-copper" /> Saved ROI estimate: {r.calculator} · {relTime(r.created_at)}</li>
              ))}
              {d.assessments.length + d.bookings.length + d.roi.length === 0 && <li className="text-muted">No activity yet.</li>}
            </ul>
          </Panel>
          <Panel title="Notes">
            <form action={addLeadNote.bind(null, id)} className="mb-4 flex gap-2">
              <label htmlFor="note" className="sr-only">Add a note</label>
              <input id="note" name="body" placeholder="Add a note (call outcome, next step…)" className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
              <button className="rounded-lg bg-brown px-4 text-sm font-semibold text-white">Add</button>
            </form>
            <ul className="space-y-3">
              {d.notes.map((n, i) => (
                <li key={i} className="rounded-xl bg-surface-2 p-3 text-sm"><p className="whitespace-pre-line">{n.body}</p><p className="mt-1 text-xs text-muted">{n.author_label} · {relTime(n.created_at)}</p></li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Stage & owner">
            <form action={updateLead.bind(null, id)} className="space-y-3 text-sm">
              <label className="block"><span className="mb-1 block text-muted">Stage</span>
                <select name="stage" defaultValue={lead.stage} className="h-10 w-full rounded-lg border border-line bg-surface px-2 capitalize">{LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <label className="block"><span className="mb-1 block text-muted">Owner</span>
                <select name="owner" defaultValue={lead.owner_id ?? ""} className="h-10 w-full rounded-lg border border-line bg-surface px-2"><option value="">Unassigned</option>{d.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
              <label className="block"><span className="mb-1 block text-muted">Lost reason (if lost)</span><input name="lostReason" defaultValue={lead.lost_reason ?? ""} className="h-10 w-full rounded-lg border border-line bg-surface px-2" /></label>
              <button className="w-full rounded-lg bg-brown py-2 font-semibold text-white">Save</button>
            </form>
          </Panel>
          <Panel title="Opportunities">
            <ul className="mb-3 space-y-2 text-sm">
              {d.opps.map((o) => <li key={o.id}><Link href={`/ops/opportunities/${o.id}`} className="font-medium hover:underline">{o.name}</Link> <Badge>{o.stage}</Badge></li>)}
            </ul>
            <form action={createOpportunity.bind(null, id)} className="space-y-2">
              <input name="name" defaultValue={`${contact?.organisation ?? "New"}: ${lead.source_detail ?? "automation"}`} className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Opportunity name" />
              <button className="w-full rounded-lg bg-surface-2 py-2 text-sm font-semibold text-heading ring-1 ring-line">Create opportunity</button>
            </form>
          </Panel>
          <Panel title="Consent record">
            <p className="mb-2 text-sm">Marketing: {marketing?.granted ? <Badge tone="good">opted in</Badge> : <Badge tone="warn">not consented, do not market</Badge>}</p>
            <ul className="space-y-1.5 text-xs text-muted">
              {d.consents.map((c, i) => <li key={i}>{c.purpose}: <strong className={c.granted ? "text-success" : "text-danger"}>{c.granted ? "granted" : "not granted"}</strong> via {c.source} · {c.notice_version} · {relTime(c.created_at)}</li>)}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
