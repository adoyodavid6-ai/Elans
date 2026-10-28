import type postgres from "postgres";

/** Illustrative demo tenant. Rebuilt on every seed; every portal page shows an "Illustrative data" banner. */
export async function seedDemoTenant(db: postgres.Sql, tenantId: string) {
  await db.begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${tenantId}, true)`;
    for (const t of ["follow_ups", "relationship_profiles", "studio_items", "campaigns", "recon_transactions", "recon_receivables",
      "etims_suppliers", "etims_invoices", "incidents", "approvals", "review_items", "run_steps", "runs", "connections", "engine_instances",
      "tickets", "documents", "invoices", "usage_events", "subscriptions", "onboarding_tasks", "projects", "dpa_requests", "messages", "handoffs", "conversations"]) {
      await tx.unsafe(`delete from ${t} where tenant_id = '${tenantId}'`);
    }
    await tx`insert into subscriptions (tenant_id, package_key, monthly_amount, allowances)
      values (${tenantId}, 'growth', 60000, ${tx.json({ document_pages: 1500, wa_conversations: 1000 })})`;
  });
}
