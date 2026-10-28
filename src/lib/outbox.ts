import "server-only";
import type { Tx } from "@/lib/db";

/**
 * Outbound messages are written to the outbox table first (transactional), then delivered by a provider.
 * With EMAIL_PROVIDER=log (default) messages are only logged, so nothing is sent from development.
 */
export async function queueMessage(tx: Tx, m: { channel: "email" | "whatsapp" | "sms"; to: string; subject?: string; body: string; meta?: Record<string, unknown> }) {
  const provider = process.env.EMAIL_PROVIDER ?? "log";
  const status = provider === "log" ? "logged" : "queued";
  await tx`insert into outbox (tenant_id, channel, to_addr, subject, body, status, meta)
    values (app_tenant(), ${m.channel}, ${m.to}, ${m.subject ?? null}, ${m.body}, ${status}, ${tx.json((m.meta ?? {}) as never)})`;
  if (provider === "log" && process.env.NODE_ENV !== "test") console.info(`[outbox:${m.channel}] → ${m.to}: ${m.subject ?? m.body.slice(0, 60)}`);
}
