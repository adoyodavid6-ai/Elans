import "../scripts/env";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

/** Outbox delivery: claimed once, sent through the provider, retried on failure. */
const run = process.env.DATABASE_URL && process.env.DATABASE_ADMIN_URL ? describe : describe.skip;
const INTERNAL = "00000000-0000-4000-8000-000000000001";

run("outbox delivery", () => {
  let admin: postgres.Sql;
  const env = { ...process.env };
  beforeAll(() => {
    admin = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1, onnotice: () => {} });
    Object.assign(process.env, { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test_dummy", EMAIL_FROM: "Elans <test@example.com>" });
  });
  afterAll(async () => {
    await admin`delete from outbox where to_addr like '%@delivery-test.example'`;
    await admin.end();
    process.env = env;
    vi.unstubAllGlobals();
  });
  const queue = async (to: string) => (await admin<{ id: string }[]>`insert into outbox (tenant_id, channel, to_addr, subject, body, status) values (${INTERNAL}, 'email', ${to}, 'Hi', 'Body', 'queued') returning id`)[0].id;

  it("sends a queued email once and marks it sent", async () => {
    const id = await queue("ok@delivery-test.example");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { if (String(init.body).includes("delivery-test")) calls.push(String(url)); return new Response("{}", { status: 200 }); }));
    const { deliverOutbox } = await import("@/lib/outbox");
    await deliverOutbox(50);
    await deliverOutbox(50);
    const [row] = await admin<{ status: string; attempts: number; sent_at: Date | null }[]>`select status, attempts, sent_at from outbox where id = ${id}`;
    expect(row.status).toBe("sent");
    expect(row.sent_at).not.toBeNull();
    expect(calls.filter((u) => u.includes("resend.com"))).toHaveLength(1);
  });

  it("puts a failed send back in the queue with the error", async () => {
    const id = await queue("fail@delivery-test.example");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("domain not verified", { status: 403 })));
    const { deliverOutbox } = await import("@/lib/outbox");
    await deliverOutbox(50);
    const [row] = await admin<{ status: string; attempts: number; last_error: string | null }[]>`select status, attempts, last_error from outbox where id = ${id}`;
    expect(row.status).toBe("queued");
    expect(row.attempts).toBe(1);
    expect(row.last_error).toContain("403");
  });
});
