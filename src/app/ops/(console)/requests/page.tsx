import Link from "next/link";
import { isSuper, requireStaff } from "@/lib/auth";
import { asStaff, relTime } from "@/lib/ops/data";
import { approveRequest, decideRequest } from "@/app/ops/request-actions";
import { PERFORMABLE } from "@/lib/ops/super-actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/Form";
import { AskSuper } from "@/components/app/AskSuper";

export const metadata = { title: "Requests" };

type Row = { id: string; kind: string; title: string; note: string | null; link: string | null; status: string; requested_label: string | null; decided_label: string | null; decision_note: string | null; decided_at: Date | null; created_at: Date };
const TONE: Record<string, "warn" | "good" | "bad" | "neutral"> = { pending: "warn", approved: "good", done: "good", declined: "bad" };

export default async function Requests({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const u = await requireStaff();
  const sup = isSuper(u);
  const rows = await asStaff(u, (tx) => tx<Row[]>`
    select id, kind, title, note, link, status, requested_label, decided_label, decision_note, decided_at, created_at from staff_requests
    where (${sup} or requested_by = ${u.id}) and (${show === "all"} or status = 'pending' or decided_at > now() - interval '14 days')
    order by (status = 'pending') desc, created_at desc limit 200`);
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");
  return (
    <>
      <PageTitle
        title={sup ? "Requests to approve" : "My requests"}
        description={sup
          ? "Admins send you anything beyond their access. Approve to carry it out in one click where possible, or open it, do it yourself and mark it done."
          : "Anything beyond Admin access goes to the Super Admin. Use the “Ask Super Admin” buttons across the console, or send a general request here."}
        actions={sup ? undefined : <AskSuper kind="general" title="General request" link="/ops/requests" label="New request" />}
      />
      <Panel title={<span className="flex items-center gap-2">Waiting <Badge tone={pending.length ? "warn" : "neutral"}>{pending.length}</Badge></span>}>
        {pending.length === 0 ? <p className="text-sm text-muted">{sup ? "Nothing waiting for you." : "You have no open requests."}</p> : (
          <ul className="divide-y divide-line">
            {pending.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-heading">{r.title}</p>
                    <p className="text-xs text-muted">{sup ? `${r.requested_label ?? "Admin"} · ` : ""}{relTime(r.created_at)}{r.link && <> · <Link href={r.link} className="text-copper-ink underline">open</Link></>}</p>
                    {r.note && <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-2 p-2 text-sm">{r.note}</p>}
                  </div>
                  {sup && (
                    <div className="flex flex-wrap items-center gap-2">
                      {PERFORMABLE.includes(r.kind)
                        ? <form action={approveRequest.bind(null, r.id)}><SubmitButton className="h-9 px-3 text-sm" pendingText="Working…">Approve &amp; do it</SubmitButton></form>
                        : r.link && <Link href={r.link} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface-2">Open to do it</Link>}
                    </div>
                  )}
                </div>
                {sup && (
                  <form className="mt-3 flex flex-wrap items-center gap-2">
                    <label htmlFor={`note-${r.id}`} className="sr-only">Reply to {r.requested_label ?? "the admin"}</label>
                    <input id={`note-${r.id}`} name="note" placeholder="Reply (optional)" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
                    {!PERFORMABLE.includes(r.kind) && <SubmitButton formAction={decideRequest.bind(null, r.id, "done")} tone="secondary" className="h-9 px-3 text-sm" pendingText="…">Mark done</SubmitButton>}
                    <SubmitButton formAction={decideRequest.bind(null, r.id, "declined")} tone="secondary" className="h-9 px-3 text-sm" pendingText="…">Decline</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Recently decided" className="mt-6" actions={show === "all" ? <Link href="/ops/requests" className="text-sm text-copper-ink hover:underline">Last 14 days</Link> : <Link href="/ops/requests?show=all" className="text-sm text-copper-ink hover:underline">Show all</Link>}>
        {decided.length === 0 ? <p className="text-sm text-muted">Nothing decided yet.</p> : (
          <ul className="divide-y divide-line">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-heading">{r.title}</p>
                  <p className="text-xs text-muted">{sup ? `${r.requested_label ?? "Admin"} · ` : ""}asked {relTime(r.created_at)}{r.decided_at ? ` · ${r.decided_label ?? "Super Admin"} ${relTime(r.decided_at)}` : ""}</p>
                  {r.decision_note && <p className="mt-1 text-xs">“{r.decision_note}”</p>}
                </div>
                <Badge tone={TONE[r.status] ?? "neutral"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
