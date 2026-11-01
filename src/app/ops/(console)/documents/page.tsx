import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { ensureDefaultTemplates } from "@/lib/documents/store";
import { formatAmount } from "@/lib/documents/compute";
import { DOC_KINDS, type DocKind } from "@/lib/documents/types";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { Icon } from "@/components/ui/Icon";

type Props = { searchParams: Promise<{ kind?: string; status?: string; q?: string }> };
const STATUS_TONE: Record<string, string> = { draft: "neutral", issued: "info", accepted: "good", void: "bad" };

export default async function Documents({ searchParams }: Props) {
  const sp = await searchParams;
  const u = await requireStaff();
  const kind = DOC_KINDS.some((k) => k.key === sp.kind) ? (sp.kind as DocKind) : null;
  const status = ["draft", "issued", "accepted", "void"].includes(sp.status ?? "") ? sp.status! : null;
  const q = (sp.q ?? "").slice(0, 80);
  const canEdit = true;
  const d = await asStaff(u, async (tx) => {
    if (canEdit) await ensureDefaultTemplates(tx, u.email);
    return {
      rows: await tx<{ id: string; kind: DocKind; number: string | null; status: string; title: string; client: { organisation?: string; name?: string }; totals: { total?: number; received?: number }; snapshot: { money?: { currency?: string } } | null; created_at: Date; issued_at: Date | null; accepted_at: Date | null }[]>`
        select id, kind, number, status, title, client, totals, snapshot, created_at, issued_at, accepted_at from issued_documents
        where (${kind}::text is null or kind = ${kind}) and (${status}::text is null or status = ${status})
          and (${q} = '' or title ilike ${"%" + q + "%"} or number ilike ${"%" + q + "%"} or client->>'organisation' ilike ${"%" + q + "%"} or client->>'name' ilike ${"%" + q + "%"})
        order by created_at desc limit 200`,
      counts: await tx<{ kind: string; n: number }[]>`select kind, count(*)::int as n from issued_documents group by kind`,
    };
  });
  const qs = (k: Record<string, string | null>) => { const p = new URLSearchParams(); for (const [a, b] of Object.entries({ kind, status, q: q || null, ...k })) if (b) p.set(a, b); const s = p.toString(); return `/ops/documents${s ? `?${s}` : ""}`; };
  return (
    <>
      <PageTitle title="Quotations, contracts & receipts" description="Create documents from your templates whenever you need them: start blank or from an existing quote, contract or paid invoice. Issued documents get the next number and a private link the client can view, download and accept." actions={canEdit ? (
        <span className="flex flex-wrap gap-2">
          <Link href="/ops/documents/templates" className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface-2"><Icon name="layers" size={16} /> Templates</Link>
          {DOC_KINDS.map((k) => <Link key={k.key} href={`/ops/documents/new?kind=${k.key}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brown px-3 text-sm font-semibold text-white hover:bg-brown-hover"><Icon name="plus" size={16} /> {k.label}</Link>)}
        </span>
      ) : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={qs({ kind: null })} className={`rounded-full px-3 py-1.5 text-sm font-medium ${!kind ? "bg-brown text-white" : "bg-surface-2"}`}>All</Link>
        {DOC_KINDS.map((k) => <Link key={k.key} href={qs({ kind: k.key })} className={`rounded-full px-3 py-1.5 text-sm font-medium ${kind === k.key ? "bg-brown text-white" : "bg-surface-2"}`}>{k.plural} <span className="opacity-70">{d.counts.find((c) => c.kind === k.key)?.n ?? 0}</span></Link>)}
        <span className="mx-1 h-5 w-px bg-line" />
        {["draft", "issued", "accepted", "void"].map((s) => <Link key={s} href={qs({ status: status === s ? null : s })} className={`rounded-full px-3 py-1.5 text-sm capitalize ${status === s ? "bg-teal-700 text-white" : "bg-surface-2"}`}>{s}</Link>)}
        <form className="ml-auto">
          {kind && <input type="hidden" name="kind" value={kind} />}{status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="doc-q" className="sr-only">Search documents</label>
          <input id="doc-q" name="q" defaultValue={q} placeholder="Search client, number, title" className="h-9 w-60 rounded-lg border border-line bg-surface px-3 text-sm" />
        </form>
      </div>
      <Panel>
        <Table head={["Document", "Client", "Type", "Status", "Total", "Updated"]} empty={canEdit ? "No documents yet. Use the buttons above to create a quotation, contract or receipt." : "No documents yet."}>
          {d.rows.map((r) => (
            <tr key={r.id} className="hover:bg-surface-2">
              <td className="px-3 py-2.5"><Link href={`/ops/documents/${r.id}`} className="font-medium text-heading hover:underline">{r.number ?? "Draft"}</Link><p className="max-w-[16rem] truncate text-xs text-muted">{r.title}</p></td>
              <td className="px-3 py-2.5">{r.client.organisation || r.client.name || "—"}</td>
              <td className="px-3 py-2.5 capitalize">{r.kind}</td>
              <td className="px-3 py-2.5"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatAmount(Number(r.kind === "receipt" ? r.totals.received ?? r.totals.total : r.totals.total ?? 0), r.snapshot?.money?.currency ?? "KES")}</td>
              <td className="px-3 py-2.5 text-xs text-muted">{r.accepted_at ? `accepted ${relTime(r.accepted_at)}` : r.issued_at ? `issued ${relTime(r.issued_at)}` : `created ${relTime(r.created_at)}`}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
