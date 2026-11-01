import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { ensureDefaultTemplates, listTemplates } from "@/lib/documents/store";
import { prefill } from "@/lib/documents/prefill";
import { DOC_KINDS, type DocKind } from "@/lib/documents/types";
import { DocumentComposer } from "@/components/documents/DocumentComposer";
import { PageTitle } from "@/components/app/AppShell";

type Props = { searchParams: Promise<{ kind?: string; template?: string; from?: string }> };

export default async function NewDocument({ searchParams }: Props) {
  const sp = await searchParams;
  const u = await requireStaff();
  const kind: DocKind = DOC_KINDS.some((k) => k.key === sp.kind) ? (sp.kind as DocKind) : "quotation";
  const d = await asStaff(u, async (tx) => {
    await ensureDefaultTemplates(tx, u.email);
    const templates = await listTemplates(tx, kind);
    const tpl = templates.find((t) => t.id === sp.template) ?? templates.find((t) => t.is_default) ?? templates[0];
    const init = tpl ? await prefill(tx, kind, tpl.config, sp.from ?? null) : null;
    return { templates, tpl, init };
  });
  const label = DOC_KINDS.find((k) => k.key === kind)!.label;
  if (!d.tpl || !d.init) return <PageTitle title={`New ${label.toLowerCase()}`} description="No template exists for this type yet." />;
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/documents", label: "Documents" }]} title={`New ${label.toLowerCase()}`} description={d.init.sourceRef ? `Pre-filled from ${d.init.sourceRef.split(":")[0]} ${d.init.data.reference || d.init.title}. Check everything, then save or issue.` : "Fill in the details; the preview on the right shows the finished document."}
        actions={<span className="flex gap-2 text-sm">{DOC_KINDS.filter((k) => k.key !== kind).map((k) => <Link key={k.key} href={`/ops/documents/new?kind=${k.key}${sp.from ? `&from=${sp.from}` : ""}`} className="rounded-lg px-3 py-2 font-semibold text-copper-ink hover:bg-surface-2">New {k.label.toLowerCase()} instead</Link>)}</span>} />
      <DocumentComposer id={null} kind={kind} templates={d.templates.map((t) => ({ id: t.id, name: t.name, is_default: t.is_default, config: t.config }))} initial={{ templateId: d.tpl.id, ...d.init }} />
    </>
  );
}
