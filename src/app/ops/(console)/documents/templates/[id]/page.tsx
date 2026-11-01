import { notFound } from "next/navigation";
import { requireStaff, isSuper } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { archiveTemplate, createTemplate, restoreTemplateRevision, setDefaultTemplate } from "@/app/ops/document-actions";
import { TemplateEditor } from "@/components/documents/TemplateEditor";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/Form";
import type { DocKind, DocTemplateConfig } from "@/lib/documents/types";

type Props = { params: Promise<{ id: string }> };

export default async function EditTemplate({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const u = await requireStaff();
  const canEdit = isSuper(u); // templates are the house standard: Super Admin only
  const d = await asStaff(u, async (tx) => {
    const [t] = await tx<{ id: string; kind: DocKind; name: string; is_default: boolean; config: DocTemplateConfig; version: number; archived: boolean }[]>`select id, kind, name, is_default, config, version, archived from doc_templates where id = ${id}`;
    if (!t) return null;
    const revisions = await tx<{ id: number; version: number; created_by: string | null; created_at: Date }[]>`select id, version, created_by, created_at from doc_template_revisions where template_id = ${id} order by id desc limit 15`;
    return { t, revisions };
  });
  if (!d) notFound();
  const { t } = d;
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/documents", label: "Documents" }, { href: "/ops/documents/templates", label: "Templates" }]} title={t.name} description={`${t.kind[0].toUpperCase()}${t.kind.slice(1)} template · version ${t.version}${t.archived ? " · archived" : ""}`}
        actions={<span className="flex flex-wrap items-center gap-2">
          {t.is_default ? <Badge tone="good">default {t.kind}</Badge> : canEdit && <form action={setDefaultTemplate.bind(null, t.id)}><SubmitButton tone="secondary" pendingText="…">Make default</SubmitButton></form>}
          {canEdit && <form action={createTemplate.bind(null, t.kind, t.id)}><SubmitButton tone="secondary" pendingText="Copying…">Duplicate</SubmitButton></form>}
          {canEdit && !t.is_default && <form action={archiveTemplate.bind(null, t.id)}><SubmitButton tone="secondary" pendingText="…">Archive</SubmitButton></form>}
        </span>} />
      <TemplateEditor id={t.id} kind={t.kind} initialName={t.name} initial={t.config} canEdit={canEdit && !t.archived} />
      {d.revisions.length > 0 && (
        <Panel title="Earlier versions" className="mt-6">
          <ul className="divide-y divide-line text-sm">
            {d.revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>Version {r.version} · saved {relTime(r.created_at)}{r.created_by ? ` by ${r.created_by}` : ""}</span>
                {canEdit && <form action={restoreTemplateRevision.bind(null, t.id, r.id)}><SubmitButton tone="secondary" className="h-8 px-3 text-xs" pendingText="…">Restore</SubmitButton></form>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
