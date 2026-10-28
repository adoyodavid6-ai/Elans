import "server-only";
import { withDb, type Tx } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security";
import { audit } from "@/lib/audit";
import { queueMessage } from "@/lib/outbox";

/**
 * Creates a client tenant when a quote is accepted: tenant, project with onboarding checklist,
 * subscription, and an invitation for the client's first administrator.
 */
export async function provisionClient(p: { name: string; adminEmail: string; packageKey: string; monthly: number; solutionSlugs: string[]; quoteId: string; currency?: string }) {
  const tenantId = await withDb({ system: true }, async (tx) => {
    const [t] = await tx<{ id: string }[]>`insert into tenants (name, kind, currency) values (${p.name}, 'client', ${p.currency ?? "KES"}) returning id`;
    return t.id;
  });
  const inviteToken = randomToken(24);
  await withDb({ tenantId }, async (tx: Tx) => {
    const [proj] = await tx<{ id: string }[]>`insert into projects (tenant_id, name, solution_slug, stage, start_date, target_date)
      values (${tenantId}, ${`${p.name}: ${p.solutionSlugs.length > 1 ? "automation programme" : "first automation"}`}, ${p.solutionSlugs[0] ?? null}, 'discover', current_date, current_date + 42) returning id`;
    const tasks: [string, "client" | "elans", number][] = [
      ["Kick-off call and confirm owner metric", "elans", 2],
      ["Share sample documents / data for the evaluation set", "client", 5],
      ["Name approvers for each action type", "client", 5],
      ["Connect integrations (sandbox first)", "elans", 10],
      ["Sign data processing agreement", "client", 7],
      ["Capture baseline measurement", "elans", 10],
      ["Staff training session", "elans", 21],
      ["Start supervised Prove period", "elans", 24],
    ];
    let i = 0;
    for (const [title, owner, days] of tasks) {
      await tx`insert into onboarding_tasks (tenant_id, project_id, title, owner, due_date, sort) values (${tenantId}, ${proj.id}, ${title}, ${owner}, current_date + ${days}::int, ${i++})`;
    }
    await tx`insert into subscriptions (tenant_id, package_key, monthly_amount, currency) values (${tenantId}, ${p.packageKey}, ${p.monthly}, ${p.currency ?? "KES"})`;
    await tx`insert into invites (tenant_id, email, role, token_hash, expires_at, created_by) values (${tenantId}, ${p.adminEmail}, 'owner', ${sha256(inviteToken)}, now() + interval '14 days', 'provisioning')`;
    await queueMessage(tx, { channel: "email", to: p.adminEmail, subject: "Welcome to Elans: activate your client portal", body: `Your Elans client portal is ready. Activate your account (link valid for 14 days):\n${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/invite/${inviteToken}` });
    await audit(tx, { tenantId, actorLabel: "provisioning", action: "tenant.provisioned", meta: { quoteId: p.quoteId } });
  });
  return { tenantId, inviteToken };
}
