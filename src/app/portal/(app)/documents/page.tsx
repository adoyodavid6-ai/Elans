import { portal } from "@/lib/portal";
import { uploadDocument } from "@/app/portal/actions";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { relTime } from "@/lib/ops/data";

const KINDS = [["contract", "Contract / SOW"], ["dpa", "Data processing agreement"], ["purchase_invoice", "Purchase invoice"], ["report", "Report"], ["process_map", "Process map"], ["other", "Other"]];

export default async function Documents() {
  const c = await portal();
  const docs = await c.db((tx) => tx<{ id: string; name: string; kind: string; mime: string | null; size_bytes: number | null; uploaded_by: string | null; created_at: Date }[]>`select id, name, kind, mime, size_bytes, uploaded_by, created_at from documents order by created_at desc limit 200`);
  return (
    <>
      <PageTitle title="Documents" description="Contracts, agreements, reports and files shared between you and Elans. Files are stored in your tenant only." />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Panel title={`Files (${docs.length})`}>
          <Table head={["Name", "Type", "Size", "Uploaded", ""]} empty="No documents yet">
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2 font-medium">{d.name}</td>
                <td className="px-3 py-2"><Badge>{KINDS.find((k) => k[0] === d.kind)?.[1] ?? d.kind}</Badge></td>
                <td className="px-3 py-2 text-xs">{d.size_bytes ? `${Math.max(1, Math.round(d.size_bytes / 1024))} KB` : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted">{d.uploaded_by ?? "—"} · {relTime(d.created_at)}</td>
                <td className="px-3 py-2"><a href={`/portal/files/${d.id}`} className="text-sm font-semibold text-copper-ink underline">Download</a></td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Upload">
          <form action={uploadDocument} className="space-y-3">
            <div><label htmlFor="file" className="text-sm font-medium">File (max 5 MB)</label><input id="file" type="file" name="file" required className="mt-1 w-full text-sm" /></div>
            <div><label htmlFor="kind" className="text-sm font-medium">Type</label><select id="kind" name="kind" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <button className="w-full rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Upload</button>
          </form>
        </Panel>
      </div>
    </>
  );
}
