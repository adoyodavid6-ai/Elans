import "../scripts/env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/** Automatic receipts: one per confirmed payment, addressed to the payer, never for unconfirmed payments. */
const run = process.env.DATABASE_URL && process.env.DATABASE_ADMIN_URL ? describe : describe.skip;
const INTERNAL = "00000000-0000-4000-8000-000000000001";

run("automatic receipts", () => {
  let admin: postgres.Sql;
  const ids: string[] = [];
  beforeAll(() => { admin = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1, onnotice: () => {} }); });
  afterAll(async () => {
    for (const id of ids) {
      await admin`delete from issued_documents where source_ref = ${`payment:${id}`}`;
      await admin`delete from bookings where payment_id = ${id}`;
      await admin`delete from payments where id = ${id}`;
    }
    await admin`delete from contacts where email = 'payer@receipts-test.example'`;
    await admin`delete from outbox where to_addr = 'payer@receipts-test.example'`;
    await admin.end();
  });
  const payment = async (status: string) => {
    const [c] = await admin<{ id: string }[]>`insert into contacts (tenant_id, name, email, organisation) values (${INTERNAL}, 'Test Payer', 'payer@receipts-test.example', 'Receipts Test Ltd') returning id`;
    const [p] = await admin<{ id: string }[]>`insert into payments (tenant_id, provider, purpose, reference, amount, status, provider_ref, idempotency_key) values (${INTERNAL}, 'mpesa', 'booking:strategy', 'STRAT', 15000, ${status}, 'QKTEST123', ${`receipts-test-${Math.random()}`}) returning id`;
    await admin`insert into bookings (tenant_id, contact_id, type, starts_at, ends_at, status, payment_id) values (${INTERNAL}, ${c.id}, 'strategy', now() + interval '10 days' + random() * interval '1 day', now() + interval '11 days', 'confirmed', ${p.id})`;
    ids.push(p.id);
    return p.id;
  };

  it("issues one numbered receipt per confirmed payment and emails the payer", async () => {
    const id = await payment("succeeded");
    const { issueReceiptForPayment } = await import("@/lib/receipts");
    const first = await issueReceiptForPayment(id);
    const again = await issueReceiptForPayment(id);
    expect(first.status).toBe("issued");
    expect(first.number).toMatch(/^RCT-\d{4}-\d{4}$/);
    expect(first.emailedTo).toBe("payer@receipts-test.example");
    expect(again.status).toBe("exists");
    const docs = await admin<{ totals: { received: number }; data: { method: string; paymentRef: string } }[]>`select totals, data from issued_documents where source_ref = ${`payment:${id}`}`;
    expect(docs).toHaveLength(1);
    expect(Number(docs[0].totals.received)).toBe(15000);
    expect(docs[0].data.method).toBe("M-Pesa");
    expect(docs[0].data.paymentRef).toBe("QKTEST123");
    const mail = await admin`select subject from outbox where to_addr = 'payer@receipts-test.example' and meta->>'paymentId' = ${id}`;
    expect(mail).toHaveLength(1);
  });

  it("does not issue a receipt for a payment that has not been confirmed", async () => {
    const id = await payment("pending");
    const { issueReceiptForPayment } = await import("@/lib/receipts");
    expect((await issueReceiptForPayment(id)).status).toBe("skipped");
  });
});
