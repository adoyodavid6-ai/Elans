import "../scripts/env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/** Super Admin / Admin split, enforced by the database as well as the app. */
const url = process.env.DATABASE_URL;
const run = url && process.env.DATABASE_ADMIN_URL ? describe : describe.skip;
const INTERNAL = "00000000-0000-4000-8000-000000000001";

run("staff access levels", () => {
  let app: postgres.Sql;
  const as = <T>(role: string, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${INTERNAL}, true), set_config('app.staff_role', ${role}, true)`;
      return fn(tx);
    }) as Promise<T>;
  const rollback = new Error("rollback");
  const attempt = (role: string, fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
    as(role, async (tx) => { await fn(tx); throw rollback; }).then(() => "ok", (e) => (e === rollback ? "ok" : "denied"));

  beforeAll(() => { app = postgres(url!, { max: 2, onnotice: () => {} }); });
  afterAll(async () => { await app.end(); });

  it("only the super admin can change prices and site settings", async () => {
    expect(await attempt("admin", (tx) => tx`update price_points set amount = amount where true`.then((r) => { if (r.count === 0) throw new Error("no rows"); }))).toBe("denied");
    expect(await attempt("super_admin", (tx) => tx`update price_points set amount = amount where true`.then((r) => { if (r.count === 0) throw new Error("no rows"); }))).toBe("ok");
    expect(await attempt("admin", (tx) => tx`update site_settings set updated_at = now() where true`.then((r) => { if (r.count === 0) throw new Error("no rows"); }))).toBe("denied");
  });

  it("admins contribute content but cannot change invoice status", async () => {
    expect(await attempt("admin", (tx) => tx`update content_items set updated_at = updated_at where true`.then((r) => { if (r.count === 0) throw new Error("no rows"); }))).toBe("ok");
    expect(await attempt("admin", (tx) => tx`select ops_set_invoice_status(gen_random_uuid(), 'paid', 'test')`)).toBe("denied");
  });

  it("staff requests stay inside the internal tenant", async () => {
    const n = await as("admin", (tx) => tx`select count(*)::int n from staff_requests where tenant_id <> ${INTERNAL}`);
    expect(n[0].n).toBe(0);
  });
});
