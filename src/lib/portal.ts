import "server-only";
import { requireClient } from "@/lib/auth";
import { withDb, type Tx } from "@/lib/db";

/** Portal request context: the signed-in member and a tenant-scoped database runner (RLS-enforced). */
export async function portal() {
  const c = await requireClient();
  return {
    ...c,
    db: <T,>(fn: (tx: Tx) => Promise<T>) => withDb({ tenantId: c.tenantId, userId: c.user.id }, fn),
  };
}
export type PortalCtx = Awaited<ReturnType<typeof portal>>;
