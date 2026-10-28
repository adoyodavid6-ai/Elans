import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { CONTENT_TYPES } from "@/lib/content";
import { PageTitle, Panel } from "@/components/app/AppShell";

const LABELS: Record<string, string> = { solution: "Solutions", category: "Solution categories", industry: "Industries", pack: "Industry packs", growth: "Growth services", frontier: "Frontier topics", template: "Templates", integration: "Integrations", resource: "Resources", example: "Illustrative examples", package: "Packages", grow_tier: "Marketing retainer tiers", division: "Divisions" };

export default async function ContentIndex() {
  const u = await requireStaff();
  const counts = await withDb({ tenantId: INTERNAL_TENANT_ID, userId: u.id }, (tx) => tx<{ type: string; n: number; drafts: number; edited: number }[]>`select type, count(*)::int as n, count(*) filter (where publish_state = 'draft')::int as drafts, count(*) filter (where edited)::int as edited from content_items group by type`);
  return (
    <>
      <PageTitle title="Content CMS" description="Everything on the public site is a record here. Edits publish within a minute. Seed updates never overwrite items edited in the console." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.keys(CONTENT_TYPES).map((t) => {
          const c = counts.find((x) => x.type === t);
          return (
            <Link key={t} href={`/ops/content/${t}`}>
              <Panel className="h-full transition hover:shadow-[var(--shadow-soft)]">
                <p className="font-semibold text-heading">{LABELS[t]}</p>
                <p className="mt-1 text-sm text-muted">{c?.n ?? 0} records · {c?.drafts ?? 0} drafts · {c?.edited ?? 0} edited</p>
              </Panel>
            </Link>
          );
        })}
      </div>
    </>
  );
}
