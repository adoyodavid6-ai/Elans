import postgres from "postgres";
import { resolveDbUrls } from "./urls";

/**
 * Database access. Every query runs inside a transaction that sets the RLS context,
 * so a missing tenant means "no rows", never "all rows".
 */
type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

declare global {
  // eslint-disable-next-line no-var
  var __elansSql: Sql | undefined;
}

export function dbConfigured(): boolean {
  return Boolean(resolveDbUrls().app);
}

export function sql(): Sql {
  const url = resolveDbUrls().app;
  if (!url) throw new DbUnavailableError();
  if (!globalThis.__elansSql) {
    globalThis.__elansSql = postgres(url, {
      max: 10,
      idle_timeout: 20,
      prepare: false,
      types: { numeric: { to: 1700, from: [1700], serialize: (v: unknown) => String(v), parse: (v: string) => Number(v) } },
    });
  }
  return globalThis.__elansSql;
}

export class DbUnavailableError extends Error {
  constructor() {
    super("Database is not configured. Set DATABASE_URL (see README).");
  }
}

export interface DbContext {
  tenantId?: string | null;
  userId?: string | null;
  staffRole?: string | null;
  system?: boolean; // auth module only
}

export async function withDb<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(async (tx) => {
    await tx`select
      set_config('app.tenant_id', ${ctx.tenantId ?? ""}, true),
      set_config('app.user_id', ${ctx.userId ?? ""}, true),
      set_config('app.staff_role', ${ctx.staffRole ?? ""}, true),
      set_config('app.auth', ${ctx.system ? "system" : ""}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

/** The Elans internal tenant owns pre-sale data: leads, assessments, bookings, chats. */
export const INTERNAL_TENANT_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_TENANT_ID = "00000000-0000-4000-8000-0000000000d1";

export function internal<T>(fn: (tx: Tx) => Promise<T>, extra: Omit<DbContext, "tenantId"> = {}) {
  return withDb({ ...extra, tenantId: INTERNAL_TENANT_ID }, fn);
}
