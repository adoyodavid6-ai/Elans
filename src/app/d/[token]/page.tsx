import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withDb } from "@/lib/db";
import { acceptDocument } from "@/app/actions/document";
import { DocumentView } from "@/components/documents/DocumentView";
import { PrintBar } from "@/components/documents/PrintBar";
import type { DocClient, DocData, DocKind, DocTemplateConfig } from "@/lib/documents/types";

export const metadata: Metadata = { title: "Your document", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ accepted?: string; error?: string }> };

/** The client's view of an issued quotation, contract or receipt, opened from the private link. */
export default async function PublicDocument({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) notFound();
  const doc = await withDb({}, async (tx) => (await tx<{ kind: DocKind; number: string; status: "issued" | "accepted"; title: string; client: DocClient; data: DocData; snapshot: DocTemplateConfig; accepted_name: string | null; accepted_at: Date | null }[]>`select * from public_document(${token})`)[0]).catch(() => null);
  if (!doc?.snapshot) notFound();
  const canAccept = doc.status === "issued" && doc.kind !== "receipt";
  const label = doc.kind === "contract" ? "agreement" : doc.kind;
  return (
    <main className="min-h-screen bg-[#ece8ea] py-6 print:bg-white print:py-0">
      <PrintBar filename={`${doc.number}-${(doc.client.organisation || doc.client.name || "document").replace(/[^\w-]+/g, "-")}`} />
      {sp.accepted && <p role="status" className="no-print mx-auto mb-4 max-w-[210mm] rounded-xl bg-[#e3f2ea] px-4 py-3 text-sm text-[#1f6f4a] print:hidden">Thank you. Your acceptance has been recorded and {doc.snapshot.company.name} has been notified.</p>}
      <div className="doc-print-root px-4 print:px-0">
        <DocumentView kind={doc.kind} cfg={doc.snapshot} client={doc.client} data={doc.data} number={doc.number} status={doc.status} accepted={doc.accepted_at ? { name: doc.accepted_name ?? "", at: new Date(doc.accepted_at).toISOString() } : null} />
      </div>
      {canAccept && (
        <form action={acceptDocument.bind(null, token)} className="no-print mx-auto mt-6 max-w-[210mm] space-y-3 rounded-2xl bg-white p-6 shadow print:hidden">
          <h2 className="text-lg font-bold text-[#2B0012]">Accept this {label}</h2>
          {sp.error && <p className="rounded-lg bg-[#f9e3e0] p-2 text-sm text-[#a1281f]">Please enter your full name and tick the box to confirm.</p>}
          <div>
            <label htmlFor="acc-name" className="mb-1 block text-sm font-semibold">Your full name</label>
            <input id="acc-name" name="name" required minLength={2} autoComplete="name" className="h-11 w-full max-w-md rounded-xl border border-[#d6cdd1] px-3" />
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" required className="mt-0.5 h-5 w-5 accent-[#6A012A]" /><span>I am authorised to accept this {label} on behalf of {doc.client.organisation || "my organisation"} and agree to its terms.</span></label>
          <button className="h-11 rounded-full bg-[#6A012A] px-6 font-semibold text-white hover:bg-[#540122]">Accept {label}</button>
          <p className="text-xs text-[#5c5c5c]">Your name, the time and your IP address are recorded as your acceptance.</p>
        </form>
      )}
    </main>
  );
}
