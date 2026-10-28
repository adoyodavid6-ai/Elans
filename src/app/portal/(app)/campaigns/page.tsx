import Link from "next/link";
import { portal } from "@/lib/portal";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { EmptyState } from "@/components/ui/primitives";

const STAGES = ["draft", "elans_review", "awaiting_client", "approved", "scheduled", "published", "changes_requested"];

export default async function Campaigns() {
  const c = await portal();
  const d = await c.db(async (tx) => ({
    campaigns: await tx<{ id: string; name: string; channel: string; status: string; start_date: string | null; end_date: string | null; kpis: Record<string, number> }[]>`select id, name, channel, status, start_date::text, end_date::text, kpis from campaigns order by start_date desc nulls last`,
    items: await tx<{ id: string; campaign_id: string | null; kind: string; title: string; status: string; ai_generated: boolean; feedback: string | null }[]>`select id, campaign_id, kind, title, status, ai_generated, feedback from studio_items order by created_at desc`,
  }));
  return (
    <>
      <PageTitle title="Campaigns & Content" description="Growth campaigns and Studio content, with the approval stage of every piece. AI-assisted content is always reviewed by Elans and signed off by you before it is published." actions={<Link href="/portal/approvals" className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Review content</Link>} />
      {d.campaigns.length === 0 ? <EmptyState icon="megaphone" title="No campaigns yet">Campaigns appear here once a Grow or Studio engagement starts.</EmptyState> : (
        <div className="space-y-6">
          {d.campaigns.map((cp) => {
            const items = d.items.filter((i) => i.campaign_id === cp.id);
            return (
              <Panel key={cp.id} title={cp.name} actions={<span className="flex gap-1"><Badge>{cp.channel}</Badge><Badge tone={cp.status === "live" ? "good" : "info"}>{cp.status}</Badge></span>}>
                <p className="text-xs text-muted">{cp.start_date ?? "—"} to {cp.end_date ?? "—"}</p>
                {Object.keys(cp.kpis).length > 0 && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {Object.entries(cp.kpis).map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-surface-2 p-3"><p className="text-xs capitalize text-muted">{k.replace(/_/g, " ")}</p><p className="text-lg font-semibold">{Number(v).toLocaleString("en-GB")}</p></div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <Table head={["Piece", "Type", "Stage", ""]} empty="No content yet">
                    {items.map((i) => (
                      <tr key={i.id}><td className="px-3 py-2">{i.title}{i.feedback && <p className="text-xs text-muted">Feedback: {i.feedback}</p>}</td><td className="px-3 py-2 text-xs">{i.kind.replace("_", " ")}{i.ai_generated && " · AI-assisted"}</td><td className="px-3 py-2"><Badge tone={i.status === "published" || i.status === "approved" ? "good" : i.status === "awaiting_client" ? "warn" : i.status === "changes_requested" ? "bad" : "neutral"}>{i.status.replace("_", " ")}</Badge></td><td className="px-3 py-2 text-xs text-muted">step {STAGES.indexOf(i.status) + 1} of 6</td></tr>
                    ))}
                  </Table>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
