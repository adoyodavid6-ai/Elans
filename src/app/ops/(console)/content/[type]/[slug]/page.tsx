import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { CONTENT_TYPES } from "@/lib/content";
import { completeness } from "@/lib/content/completeness";
import type { Solution } from "@/content/types";
import { duplicateContentItem, restoreRevision } from "@/app/ops/cms-actions";
import { PageTitle, Panel, Badge } from "@/components/app/AppShell";
import { ContentEditor } from "@/components/app/ContentEditor";
import { relTime } from "@/lib/ops/data";

type Props = { params: Promise<{ type: string; slug: string }> };

const PUBLIC_PATH: Record<string, (d: Record<string, unknown>) => string | null> = {
  solution: (d) => `/solutions/${d.category}/${d.slug}`,
  industry: (d) => `/industries/${d.slug}`,
  growth: (d) => `/growth/${d.slug}`,
  frontier: (d) => `/frontier/${d.slug}`,
  template: (d) => `/templates/${d.slug}`,
  resource: (d) => `/resources/${d.slug}`,
  category: (d) => `/solutions/${d.slug}`,
  pack: (d) => `/industries/${d.industry}/packs/${d.slug}`,
  package: (d) => `/pricing/${d.key}`,
};

export default async function ContentEdit({ params }: Props) {
  const { type, slug } = await params;
  if (!(type in CONTENT_TYPES)) notFound();
  const u = await requireStaff();
  const d = await withDb({ tenantId: INTERNAL_TENANT_ID, userId: u.id }, async (tx) => {
    const [item] = await tx<{ data: Record<string, unknown>; publish_state: string; version: number; updated_at: Date; updated_by: string | null; edited: boolean }[]>`select data, publish_state, version, updated_at, updated_by, edited from content_items where type = ${type} and slug = ${slug}`;
    const revisions = await tx<{ id: number; version: number; created_at: Date; created_by: string | null }[]>`select id, version, created_at, created_by from content_revisions where type = ${type} and slug = ${slug} order by id desc limit 15`;
    return { item, revisions };
  });
  if (!d.item) notFound();
  const comp = type === "solution" ? completeness(d.item.data as unknown as Solution) : null;
  const canEdit = u.staffRole === "admin" || u.staffRole === "content_editor";
  const path = PUBLIC_PATH[type]?.(d.item.data);
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/content", label: "Content" }, { href: `/ops/content/${type}`, label: type }]} title={String(d.item.data.name ?? d.item.data.title ?? slug)} description={`v${d.item.version} · updated ${relTime(d.item.updated_at)}${d.item.updated_by ? ` by ${d.item.updated_by}` : ""}`} actions={path && d.item.publish_state === "published" ? <a href={path} target="_blank" className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold ring-1 ring-line">View on site</a> : undefined} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ContentEditor type={type} slug={slug} data={d.item.data} publishState={d.item.publish_state} canEdit={canEdit} />
        <div className="space-y-6">
          {comp && (
            <Panel title="Completeness gate">
              <p className="text-sm"><Badge tone={comp.complete ? "good" : "warn"}>{comp.score}%</Badge> {comp.complete ? "All §5.2 fields present; page is indexable." : `Missing: ${comp.missing.join(", ")}. The page renders noindex until complete.`}</p>
            </Panel>
          )}
          <Panel title="Duplicate to create a new record">
            <form action={duplicateContentItem.bind(null, type, slug)} className="flex gap-2">
              <input name="newSlug" required placeholder="new-url-slug" aria-label="New slug" className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-sm" />
              <button disabled={!canEdit} className="rounded-lg bg-surface-2 px-3 text-sm font-semibold ring-1 ring-line disabled:opacity-50">Duplicate</button>
            </form>
            <p className="mt-2 text-xs text-muted">The copy starts as a draft with status Planned.</p>
          </Panel>
          <Panel title="Revisions">
            {d.revisions.length === 0 ? <p className="text-sm text-muted">No previous versions.</p> : (
              <ul className="space-y-2 text-sm">
                {d.revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span>v{r.version} · {relTime(r.created_at)} {r.created_by && `· ${r.created_by}`}</span>
                    {canEdit && <form action={restoreRevision.bind(null, type, slug, r.id)}><button className="rounded-md bg-surface-2 px-2 py-1 text-xs ring-1 ring-line">Restore</button></form>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
