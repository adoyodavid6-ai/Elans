import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, LEAD_STAGES, relTime } from "@/lib/ops/data";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { EmptyState } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

type Props = { searchParams: Promise<{ stage?: string; source?: string; q?: string }> };

export default async function Leads({ searchParams }: Props) {
  const sp = await searchParams;
  const u = await requireStaff();
  const stage = LEAD_STAGES.includes(sp.stage as never) ? sp.stage! : null;
  const q = (sp.q ?? "").slice(0, 80);
  const rows = await asStaff(u, (tx) => tx<{ id: string; name: string | null; email: string | null; organisation: string | null; source: string; source_detail: string | null; industry: string | null; score: number; stage: string; created_at: Date; next_action: string | null; next_action_due: string | null; marketing: boolean | null }[]>`
    select l.id, c.name, c.email, c.organisation, l.source, l.source_detail, l.industry, l.score, l.stage, l.created_at, l.next_action, l.next_action_due::text,
      (select granted from consents k where k.contact_id = c.id and k.purpose = 'marketing' order by k.created_at desc limit 1) as marketing
    from leads l left join contacts c on c.id = l.contact_id
    where (${stage}::text is null or l.stage = ${stage}) and (${sp.source ?? null}::text is null or l.source = ${sp.source ?? null})
      and (${q} = '' or c.name ilike ${"%" + q + "%"} or c.organisation ilike ${"%" + q + "%"} or c.email ilike ${"%" + q + "%"})
    order by l.created_at desc limit 200`);
  const counts = await asStaff(u, (tx) => tx<{ stage: string; n: number }[]>`select stage, count(*)::int as n from leads group by stage`);
  const n = (s: string) => counts.find((c) => c.stage === s)?.n ?? 0;
  return (
    <>
      <PageTitle title="Leads & CRM" description="Every enquiry from the assessment, calculators, chat, bookings and forms, plus leads your team adds. Click a lead to work it." actions={<span className="flex flex-wrap gap-2"><a href={`/ops/leads-export${stage ? `?stage=${stage}` : ""}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface-2"><Icon name="download" size={16} /> Export CSV</a><Link href="/ops/leads/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brown px-4 text-sm font-semibold text-white hover:bg-brown-hover"><Icon name="plus" size={16} /> Add a lead</Link></span>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/ops/leads" className={`rounded-full px-3 py-1.5 text-sm font-medium ${!stage ? "bg-brown text-white" : "bg-surface-2"}`}>All</Link>
        {LEAD_STAGES.map((s) => (
          <Link key={s} href={`/ops/leads?stage=${s}`} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${stage === s ? "bg-brown text-white" : "bg-surface-2"}`}>{s} <span className="opacity-70">{n(s)}</span></Link>
        ))}
        <form className="ml-auto">
          {stage && <input type="hidden" name="stage" value={stage} />}
          <label htmlFor="q" className="sr-only">Search leads</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search name, company, email" className="h-9 w-64 rounded-lg border border-line bg-surface px-3 text-sm" />
        </form>
      </div>
      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="No leads match">Try clearing the filters.</EmptyState>
        ) : (
          <Table head={["Lead", "Source", "Score", "Stage", "Next step", "Marketing consent", "Created"]}>
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-surface-2">
                <td className="px-3 py-2.5"><Link href={`/ops/leads/${l.id}`} className="font-medium text-heading hover:underline">{l.organisation || l.name || "Unknown"}</Link><p className="text-xs text-muted">{l.name} · {l.email}</p></td>
                <td className="px-3 py-2.5"><Badge tone="brand">{l.source}</Badge><p className="mt-0.5 max-w-[14rem] truncate text-xs text-muted">{l.source_detail}</p></td>
                <td className="px-3 py-2.5"><Badge tone={l.score >= 50 ? "good" : l.score >= 30 ? "warn" : "neutral"}>{l.score}</Badge></td>
                <td className="px-3 py-2.5 capitalize">{l.stage}</td>
                <td className="px-3 py-2.5 text-xs">{l.next_action ? <><p className="max-w-[14rem] truncate font-medium text-heading">{l.next_action}</p>{l.next_action_due && <p className={l.next_action_due < new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }) ? "font-semibold text-danger" : "text-muted"}>due {l.next_action_due}</p>}</> : <span className="text-muted">—</span>}</td>
                <td className="px-3 py-2.5">{l.marketing ? <Badge tone="good">Yes</Badge> : <Badge>No</Badge>}</td>
                <td className="px-3 py-2.5 text-muted">{relTime(l.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
