import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { ensureDefaultTemplates, listTemplates } from "@/lib/documents/store";
import { createTemplate, setDefaultTemplate } from "@/app/ops/document-actions";
import { DOC_KINDS } from "@/lib/documents/types";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/Form";

export default async function Templates() {
  const u = await requireStaff();
  const canEdit = u.staffRole === "admin" || u.staffRole === "consultant";
  const rows = await asStaff(u, async (tx) => { if (canEdit) await ensureDefaultTemplates(tx, u.email); return listTemplates(tx); });
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/documents", label: "Documents" }]} title="Document templates" description="Design how your quotations, contracts and receipts look and read. Each type can have several templates (for example a short quote and a detailed proposal); the default is used unless you pick another." />
      <div className="grid gap-6 xl:grid-cols-3">
        {DOC_KINDS.map((k) => (
          <Panel key={k.key} title={k.plural} actions={canEdit ? <form action={createTemplate.bind(null, k.key, null)}><SubmitButton tone="secondary" className="h-8 px-3 text-xs" pendingText="Creating…">+ New</SubmitButton></form> : undefined}>
            <ul className="divide-y divide-line">
              {rows.filter((t) => t.kind === k.key).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link href={`/ops/documents/templates/${t.id}`} className="font-medium text-heading hover:underline">{t.name}</Link> {t.is_default && <Badge tone="good">default</Badge>}
                    <p className="text-xs text-muted">v{t.version} · updated {relTime(t.updated_at)}{t.updated_by ? ` by ${t.updated_by}` : ""}</p>
                  </div>
                  <span className="flex gap-1">
                    <Link href={`/ops/documents/templates/${t.id}`} className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold ring-1 ring-line hover:bg-surface-2">{canEdit ? "Edit" : "View"}</Link>
                    {canEdit && !t.is_default && <form action={setDefaultTemplate.bind(null, t.id)}><SubmitButton tone="secondary" className="h-8 px-3 text-xs" pendingText="…">Make default</SubmitButton></form>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}
