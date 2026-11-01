import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { DocumentView } from "@/components/documents/DocumentView";
import { PrintBar } from "@/components/documents/PrintBar";
import type { DocClient, DocData, DocKind, DocTemplateConfig } from "@/lib/documents/types";

export const metadata: Metadata = { title: "Print document", robots: { index: false, follow: false } };

/** Clean page for printing or "Save as PDF" (no console chrome). */
export default async function PrintDocument({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const u = await requireStaff();
  const doc = await asStaff(u, async (tx) => {
    const [r] = await tx<{ kind: DocKind; number: string | null; status: "draft" | "issued" | "accepted" | "void"; client: DocClient; data: DocData; snapshot: DocTemplateConfig | null; template_id: string | null; accepted_name: string | null; accepted_at: Date | null }[]>`select kind, number, status, client, data, snapshot, template_id, accepted_name, accepted_at from issued_documents where id = ${id}`;
    if (!r) return null;
    const cfg = r.snapshot ?? (await tx<{ config: DocTemplateConfig }[]>`select config from doc_templates where id = ${r.template_id}`)[0]?.config;
    return cfg ? { ...r, cfg } : null;
  });
  if (!doc) notFound();
  return (
    <main className="min-h-screen bg-[#ece8ea] py-6 print:bg-white print:py-0">
      <PrintBar filename={`${doc.number ?? "draft"}-${(doc.client.organisation || doc.client.name || "document").replace(/[^\w-]+/g, "-")}`} back={`/ops/documents/${id}`} />
      <div className="doc-print-root px-4 print:px-0">
        <DocumentView kind={doc.kind} cfg={doc.cfg} client={doc.client} data={doc.data} number={doc.number} status={doc.status} accepted={doc.accepted_at ? { name: doc.accepted_name ?? "", at: doc.accepted_at.toISOString() } : null} />
      </div>
    </main>
  );
}
