import "server-only";
import type { Tx } from "@/lib/db";

export async function audit(
  tx: Tx,
  e: { tenantId: string; actorId?: string | null; actorLabel?: string; action: string; entity?: string; entityId?: string; meta?: Record<string, unknown> },
) {
  await tx`insert into audit_log (tenant_id, actor_id, actor_label, action, entity, entity_id, meta)
    values (${e.tenantId}, ${e.actorId ?? null}, ${e.actorLabel ?? null}, ${e.action}, ${e.entity ?? null}, ${e.entityId ?? null}, ${tx.json((e.meta ?? {}) as never)})`;
}
