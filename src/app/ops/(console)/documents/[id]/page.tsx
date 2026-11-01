import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, isSuper } from "@/lib/auth";
import { AskSuper } from "@/components/app/AskSuper";
import { asStaff, relTime } from "@/lib/ops/data";
import { listTemplates } from "@/lib/documents/store";
import { duplicateDocument, emailDocument, issueDocument, voidDocument } from "@/app/ops/document-actions";
import { DocumentComposer } from "@/components/documents/DocumentComposer";
import { DocumentView } from "@/components/documents/DocumentView";
import { CopyLink } from "@/components/documents/CopyLink";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { Input, SubmitButton } from "@/components/app/Form";
import { Icon } from "@/components/ui/Icon";
import type { DocClient, DocData, DocKind, DocTemplateConfig } from "@/lib/documents/types";

type Props = { params: Promise<{ id: string }> };
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function DocumentDetail({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const u = await requireStaff();
  const canEdit = true;
  const sup = isSuper(u);
  const d = await asStaff(u, async (tx) => {
    const [doc] = await tx<{ id: string; kind: DocKind; number: string | null; status: "draft" | "issued" | "accepted" | "void"; title: string; template_id: string | null; client: DocClient; data: DocData; snapshot: DocTemplateConfig | null; source_ref: string | null; public_token: string | null; accepted_name: string | null; accepted_at: Date | null; issued_at: Date | null; created_by: string | null; created_at: Date }[]>`select * from issued_documents where id = ${id}`;
    if (!doc) return null;
    const templates = await listTemplates(tx, doc.kind);
    return { doc, templates };
  });
  if (!d) notFound();
  const { doc } = d;
  const cfg = doc.snapshot ?? d.templates.find((t) => t.id === doc.template_id)?.config ?? d.templates[0]?.config;
  const label = doc.kind[0].toUpperCase() + doc.kind.slice(1);
  const link = doc.public_token ? `${site()}/d/${doc.public_token}` : null;

  if (doc.status === "draft" && canEdit) {
    return (
      <>
        <PageTitle crumbs={[{ href: "/ops/documents", label: "Documents" }]} title={`${label} draft: ${doc.title}`} description="Edit and save as often as you like. Issuing assigns the next number and locks the document."
          actions={<span className="flex gap-2"><form action={duplicateDocument.bind(null, id)}><SubmitButton tone="secondary" pendingText="…">Duplicate</SubmitButton></form><form action={voidDocument.bind(null, id)}><SubmitButton tone="secondary" pendingText="…">Discard draft</SubmitButton></form></span>} />
        <DocumentComposer id={doc.id} kind={doc.kind} templates={d.templates.map((t) => ({ id: t.id, name: t.name, is_default: t.is_default, config: t.config }))} initial={{ templateId: doc.template_id ?? d.templates[0].id, title: doc.title, client: doc.client, data: doc.data, sourceRef: doc.source_ref }} />
      </>
    );
  }

  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/documents", label: "Documents" }]} title={`${label} ${doc.number ?? "(draft)"}`} description={`${doc.client.organisation || doc.client.name}${doc.issued_at ? ` · issued ${relTime(doc.issued_at)}` : ""}${doc.created_by ? ` · by ${doc.created_by}` : ""}`}
        actions={<Badge tone={doc.status === "accepted" ? "good" : doc.status === "void" ? "bad" : doc.status === "issued" ? "info" : "neutral"}>{doc.status}</Badge>} />
      <div className="grid gap-6 2xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 overflow-auto rounded-2xl bg-surface-2 p-4" tabIndex={0} role="region" aria-label="Document">
          {cfg && <DocumentView kind={doc.kind} cfg={cfg} client={doc.client} data={doc.data} number={doc.number} status={doc.status} accepted={doc.accepted_at ? { name: doc.accepted_name ?? "", at: doc.accepted_at.toISOString() } : null} />}
        </div>
        <div className="space-y-4">
          <Panel title="Actions">
            <div className="flex flex-col gap-2">
              <a href={`/ops/print/${doc.id}`} target="_blank" rel="noopener" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brown px-4 text-sm font-semibold text-white hover:bg-brown-hover"><Icon name="download" size={16} /> Print / save as PDF</a>
              {canEdit && doc.status === "draft" && <form action={issueDocument.bind(null, id)}><SubmitButton className="w-full" pendingText="Issuing…">Issue</SubmitButton></form>}
              {canEdit && <form action={duplicateDocument.bind(null, id)}><SubmitButton tone="secondary" className="w-full" pendingText="…">Duplicate as new draft</SubmitButton></form>}
              {canEdit && doc.kind === "quotation" && doc.status !== "void" && <Link href={`/ops/documents/new?kind=contract&from=doc:${doc.id}`} className="inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold ring-1 ring-line hover:bg-surface-2">Turn into a contract</Link>}
              {canEdit && doc.kind !== "receipt" && doc.status !== "void" && <Link href={`/ops/documents/new?kind=receipt&from=doc:${doc.id}`} className="inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold ring-1 ring-line hover:bg-surface-2">Issue a receipt</Link>}
              {doc.status !== "void" && (sup ? <form action={voidDocument.bind(null, id)}><SubmitButton tone="secondary" className="w-full" pendingText="…">Void</SubmitButton></form> : <AskSuper kind="document.void" title={`Void ${doc.number ?? "draft"} (${doc.kind})`} link={`/ops/documents/${id}`} payload={{ documentId: id }} label="Void (ask Super Admin)" className="w-full [&>button]:w-full [&>button]:justify-center" />)}
            </div>
          </Panel>
          {link && doc.status !== "void" && (
            <Panel title="Client link">
              <p className="mb-2 text-xs text-muted">Anyone with this link can view{doc.kind !== "receipt" ? " and accept" : ""} the document and download it as a PDF. It stops working if the document is voided.</p>
              <CopyLink url={link} />
              {canEdit && (
                <form action={emailDocument.bind(null, id)} className="mt-3 flex gap-2">
                  <label htmlFor="doc-to" className="sr-only">Email address</label>
                  <Input id="doc-to" name="to" type="email" required defaultValue={doc.client.email} placeholder="client@example.com" className="min-w-0 flex-1" />
                  <SubmitButton pendingText="Sending…">Send</SubmitButton>
                </form>
              )}
            </Panel>
          )}
          {doc.accepted_at && <Panel title="Acceptance"><p className="text-sm">Accepted online by <strong>{doc.accepted_name}</strong> {relTime(doc.accepted_at)}.</p></Panel>}
          {doc.source_ref && <Panel title="Source"><p className="text-sm text-muted">Created from {doc.source_ref.split(":")[0]} {doc.data.reference}</p></Panel>}
        </div>
      </div>
    </>
  );
}
