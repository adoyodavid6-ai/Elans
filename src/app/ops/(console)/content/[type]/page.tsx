import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { CONTENT_TYPES } from "@/lib/content";
import { completeness } from "@/lib/content/completeness";
import type { Solution } from "@/content/types";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";

type Props = { params: Promise<{ type: string }>; searchParams: Promise<{ q?: string }> };

export default async function ContentList({ params, searchParams }: Props) {
  const { type } = await params;
  const { q = "" } = await searchParams;
  if (!(type in CONTENT_TYPES)) notFound();
  const u = await requireStaff();
  const rows = await withDb({ tenantId: INTERNAL_TENANT_ID, userId: u.id }, (tx) => tx<{ slug: string; data: Record<string, unknown>; publish_state: string; edited: boolean; version: number; updated_at: Date; updated_by: string | null }[]>`
    select slug, data, publish_state, edited, version, updated_at, updated_by from content_items where type = ${type} and (${q} = '' or slug ilike ${"%" + q + "%"} or data::text ilike ${"%" + q + "%"}) order by slug`);
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/content", label: "Content" }]} title={type} description={`${rows.length} records`} actions={<form><input name="q" defaultValue={q} placeholder="Search" aria-label="Search" className="h-9 w-56 rounded-lg border border-line bg-surface px-3 text-sm" /></form>} />
      <Panel>
        <Table head={["Record", "Status", "Publish", "Completeness", "Version", "Updated"]}>
          {rows.map((r) => {
            const name = String(r.data.name ?? r.data.title ?? r.slug);
            const comp = type === "solution" ? completeness(r.data as unknown as Solution) : null;
            return (
              <tr key={r.slug} className="hover:bg-surface-2">
                <td className="px-3 py-2"><Link href={`/ops/content/${type}/${r.slug}`} className="font-medium hover:underline">{name}</Link><p className="font-mono text-xs text-muted">{r.slug}</p></td>
                <td className="px-3 py-2">{r.data.status ? <Badge tone={r.data.status === "live" ? "good" : r.data.status === "pilot" ? "info" : "neutral"}>{String(r.data.status)}</Badge> : "—"}</td>
                <td className="px-3 py-2"><Badge tone={r.publish_state === "draft" ? "warn" : "good"}>{r.publish_state}</Badge>{r.edited && <Badge tone="brand">edited</Badge>}</td>
                <td className="px-3 py-2">{comp ? <Badge tone={comp.complete ? "good" : "warn"}>{comp.score}%</Badge> : "—"}</td>
                <td className="px-3 py-2">v{r.version}</td>
                <td className="px-3 py-2 text-muted">{relTime(r.updated_at)} {r.updated_by && `· ${r.updated_by}`}</td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </>
  );
}
