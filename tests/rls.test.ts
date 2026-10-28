import "../scripts/env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/**
 * Tenant isolation, tested against a real database as the application role (NOBYPASSRLS).
 * Skipped when DATABASE_URL / DATABASE_ADMIN_URL are not set (e.g. a laptop without Postgres).
 */
const url = process.env.DATABASE_URL;
const adminUrl = process.env.DATABASE_ADMIN_URL;
const run = url && adminUrl ? describe : describe.skip;

const A = "00000000-0000-4000-8000-00000000aaa1";
const B = "00000000-0000-4000-8000-00000000bbb1";

run("row-level security", () => {
  let app: postgres.Sql;
  let admin: postgres.Sql;
  const as = <T>(tenant: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${tenant ?? ""}, true)`;
      return fn(tx);
    }) as Promise<T>;

  beforeAll(async () => {
    app = postgres(url!, { max: 2, onnotice: () => {} });
    admin = postgres(adminUrl!, { max: 1, onnotice: () => {} });
    for (const [id, name] of [[A, "RLS test A"], [B, "RLS test B"]]) {
      await admin`insert into tenants (id, name, kind) values (${id}, ${name}, 'client') on conflict (id) do nothing`;
      await admin`delete from tickets where tenant_id = ${id}`;
      await admin`insert into tickets (tenant_id, subject) values (${id}, ${`secret of ${name}`})`;
    }
  });
  afterAll(async () => {
    await admin`delete from tenants where id in (${A}, ${B})`;
    await app.end();
    await admin.end();
  });

  it("the app role cannot bypass RLS", async () => {
    const [r] = await app<{ rolbypassrls: boolean; rolsuper: boolean }[]>`select rolbypassrls, rolsuper from pg_roles where rolname = current_user`;
    expect(r.rolbypassrls).toBe(false);
    expect(r.rolsuper).toBe(false);
  });

  it("a tenant sees only its own rows", async () => {
    const rows = await as(A, (tx) => tx<{ subject: string }[]>`select subject from tickets`);
    expect(rows.map((r) => r.subject)).toEqual(["secret of RLS test A"]);
  });

  it("no tenant context means no rows, not all rows", async () => {
    const rows = await as(null, (tx) => tx`select id from tickets`);
    expect(rows.length).toBe(0);
  });

  it("cannot write into another tenant", async () => {
    await expect(as(A, (tx) => tx`insert into tickets (tenant_id, subject) values (${B}, 'injected')`)).rejects.toThrow();
  });

  it("cannot update or delete another tenant's rows", async () => {
    const upd = await as(A, (tx) => tx`update tickets set subject = 'hijacked' where tenant_id = ${B}`);
    const del = await as(A, (tx) => tx`delete from tickets where tenant_id = ${B}`);
    expect(upd.count).toBe(0);
    expect(del.count).toBe(0);
    const [b] = await admin<{ subject: string }[]>`select subject from tickets where tenant_id = ${B}`;
    expect(b.subject).toBe("secret of RLS test B");
  });

  it("runtime tables are isolated too", async () => {
    const rows = await as(A, (tx) => tx`select id from engine_instances union all select id from etims_invoices union all select id from conversations`);
    expect(rows.length).toBe(0);
  });
});
