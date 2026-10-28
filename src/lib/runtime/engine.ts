import "server-only";
import type { Tx } from "@/lib/db";
import { sha256 } from "@/lib/security";

/**
 * Elans workflow runtime (Phase 4). Every automation run is recorded as a ledger of steps:
 * rules, AI calls, actions, reviews and approvals — with input hashes, outputs, confidence,
 * model and prompt version, attempts and timing. Side-effecting steps check kill switches first.
 *
 * Production note (ARCHITECTURE §3): long-running waits (reviews, approvals) are modelled as run
 * states in Postgres, so the same handlers can be driven by Inngest functions without change.
 */

export class BlockedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "BlockedError";
  }
}

export interface RunCtx {
  tx: Tx;
  tenantId: string;
  instanceId: string;
  runId: string;
  seq: number;
  cost: number;
}

export interface EngineInstance {
  id: string;
  tenant_id: string;
  solution_slug: string;
  name: string;
  status: string;
  autonomy: Record<string, "approve" | "auto">;
  config: Record<string, unknown>;
  kill_switch: boolean;
  monthly_budget: number;
}

export async function loadInstance(tx: Tx, instanceId: string): Promise<EngineInstance | null> {
  const [i] = await tx<EngineInstance[]>`select * from engine_instances where id = ${instanceId}`;
  return i ?? null;
}

/** Throws BlockedError if the automation or the whole tenant is switched off, or the instance is paused. */
export async function assertNotKilled(tx: Tx, instanceId: string) {
  const [r] = await tx<{ kill: boolean; tkill: boolean; status: string }[]>`
    select e.kill_switch as kill, t.kill_switch as tkill, e.status from engine_instances e join tenants t on t.id = e.tenant_id where e.id = ${instanceId}`;
  if (!r) throw new BlockedError("Automation not found");
  if (r.tkill) throw new BlockedError("Account-wide kill switch is on");
  if (r.kill) throw new BlockedError("Kill switch is on for this automation");
  if (r.status === "paused") throw new BlockedError("Automation is paused");
}

/** Starts a run, or returns the existing one for the same idempotency key (duplicate events are no-ops). */
export async function startRun(tx: Tx, p: { tenantId: string; instanceId: string; trigger: string; idempotencyKey: string; input: Record<string, unknown> }): Promise<{ ctx: RunCtx; duplicate: boolean }> {
  const inserted = await tx<{ id: string }[]>`insert into runs (tenant_id, engine_instance_id, trigger, idempotency_key, input)
    values (${p.tenantId}, ${p.instanceId}, ${p.trigger}, ${p.idempotencyKey}, ${tx.json(p.input as never)})
    on conflict (engine_instance_id, idempotency_key) do nothing returning id`;
  if (inserted.length) return { ctx: { tx, tenantId: p.tenantId, instanceId: p.instanceId, runId: inserted[0].id, seq: 0, cost: 0 }, duplicate: false };
  const [existing] = await tx<{ id: string }[]>`select id from runs where engine_instance_id = ${p.instanceId} and idempotency_key = ${p.idempotencyKey}`;
  return { ctx: { tx, tenantId: p.tenantId, instanceId: p.instanceId, runId: existing.id, seq: 999, cost: 0 }, duplicate: true };
}

export async function resumeRun(tx: Tx, runId: string): Promise<RunCtx> {
  const [r] = await tx<{ tenant_id: string; engine_instance_id: string; seq: number; cost: number }[]>`
    select r.tenant_id, r.engine_instance_id, coalesce((select max(seq) from run_steps s where s.run_id = r.id), 0) as seq, r.cost from runs r where r.id = ${runId}`;
  return { tx, tenantId: r.tenant_id, instanceId: r.engine_instance_id, runId, seq: Number(r.seq), cost: Number(r.cost) };
}

type StepKind = "rule" | "ai" | "action" | "review" | "approval";
export interface StepMeta {
  confidence?: number;
  model?: string;
  promptVersion?: string;
  cost?: number;
}

/**
 * Records a step. Actions are retried with exponential backoff (3 attempts); their kill switch is
 * checked first. A failing step is recorded and re-thrown so the caller can open an incident.
 */
export async function step<T>(ctx: RunCtx, name: string, kind: StepKind, input: unknown, fn: () => Promise<{ output: T; meta?: StepMeta }>): Promise<T> {
  if (kind === "action") await assertNotKilled(ctx.tx, ctx.instanceId);
  const started = Date.now();
  const maxAttempts = kind === "action" ? 3 : 1;
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const { output, meta } = await fn();
      ctx.seq += 1;
      ctx.cost += meta?.cost ?? 0;
      await ctx.tx`insert into run_steps (tenant_id, run_id, seq, name, kind, status, input_hash, output, confidence, model, prompt_version, attempts, duration_ms)
        values (${ctx.tenantId}, ${ctx.runId}, ${ctx.seq}, ${name}, ${kind}, 'succeeded', ${sha256(JSON.stringify(input ?? null)).slice(0, 24)}, ${ctx.tx.json(toJson(output))},
          ${meta?.confidence ?? null}, ${meta?.model ?? null}, ${meta?.promptVersion ?? null}, ${attempt}, ${Date.now() - started})`;
      return output;
    } catch (e) {
      lastErr = e;
      if (e instanceof BlockedError) break;
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 2 ** attempt * 50));
    }
  }
  ctx.seq += 1;
  await ctx.tx`insert into run_steps (tenant_id, run_id, seq, name, kind, status, input_hash, attempts, duration_ms, error)
    values (${ctx.tenantId}, ${ctx.runId}, ${ctx.seq}, ${name}, ${kind}, 'failed', ${sha256(JSON.stringify(input ?? null)).slice(0, 24)}, ${attempt}, ${Date.now() - started}, ${String((lastErr as Error)?.message ?? lastErr).slice(0, 500)})`;
  throw lastErr;
}

function toJson(v: unknown): never {
  return JSON.parse(JSON.stringify(v ?? {})) as never;
}

/** Sends something to a person and marks the run as waiting. */
export async function requireReview(ctx: RunCtx, p: { kind: string; title: string; payload: Record<string, unknown>; queue?: "elans" | "client"; slaHours?: number }) {
  ctx.seq += 1;
  await ctx.tx`insert into run_steps (tenant_id, run_id, seq, name, kind, status, output) values (${ctx.tenantId}, ${ctx.runId}, ${ctx.seq}, ${`Human review: ${p.title}`.slice(0, 200)}, 'review', 'waiting', ${ctx.tx.json(toJson({ kind: p.kind }))})`;
  const [r] = await ctx.tx<{ id: string }[]>`insert into review_items (tenant_id, run_id, engine_instance_id, queue, kind, title, payload, sla_due_at)
    values (${ctx.tenantId}, ${ctx.runId}, ${ctx.instanceId}, ${p.queue ?? "elans"}, ${p.kind}, ${p.title}, ${ctx.tx.json(toJson(p.payload))}, now() + ${`${p.slaHours ?? 4} hours`}::interval) returning id`;
  await ctx.tx`update runs set status = 'waiting_review' where id = ${ctx.runId}`;
  return r.id;
}

/**
 * Approval gate. If the client has opted in to autonomy for this action type, returns "auto"
 * and the caller proceeds; otherwise an approval is created and the run waits.
 */
export async function gate(ctx: RunCtx, p: { actionType: string; title: string; summary: string; proposed: Record<string, unknown> }): Promise<"auto" | "pending"> {
  const inst = await loadInstance(ctx.tx, ctx.instanceId);
  if (inst?.autonomy?.[p.actionType] === "auto") return "auto";
  ctx.seq += 1;
  await ctx.tx`insert into run_steps (tenant_id, run_id, seq, name, kind, status, output) values (${ctx.tenantId}, ${ctx.runId}, ${ctx.seq}, ${`Approval: ${p.title}`.slice(0, 200)}, 'approval', 'waiting', ${ctx.tx.json(toJson({ actionType: p.actionType }))})`;
  await ctx.tx`insert into approvals (tenant_id, run_id, engine_instance_id, action_type, title, summary, proposed) values (${ctx.tenantId}, ${ctx.runId}, ${ctx.instanceId}, ${p.actionType}, ${p.title}, ${p.summary}, ${ctx.tx.json(toJson(p.proposed))})`;
  await ctx.tx`update runs set status = 'waiting_approval' where id = ${ctx.runId} and status = 'running'`;
  return "pending";
}

export async function meter(ctx: RunCtx, m: string, quantity: number, cost = 0) {
  await ctx.tx`insert into usage_events (tenant_id, meter, quantity, cost, run_id) values (${ctx.tenantId}, ${m}, ${quantity}, ${cost}, ${ctx.runId})`;
}

export async function finishRun(ctx: RunCtx, status: "succeeded" | "failed" | "blocked", output: Record<string, unknown> = {}, error?: string) {
  await ctx.tx`update runs set status = case when status in ('waiting_review','waiting_approval') and ${status} = 'succeeded' then status else ${status} end,
    output = output || ${ctx.tx.json(toJson(output))}, cost = cost + ${ctx.cost}, error = ${error ?? null},
    finished_at = case when ${status} <> 'succeeded' or status not in ('waiting_review','waiting_approval') then now() else finished_at end
    where id = ${ctx.runId}`;
}

/** Marks a waiting run complete once nothing is outstanding. */
export async function settleRunIfDone(tx: Tx, runId: string) {
  const [o] = await tx<{ open: number }[]>`select (select count(*) from review_items where run_id = ${runId} and status = 'open') + (select count(*) from approvals where run_id = ${runId} and status = 'pending') as open`;
  if (Number(o.open) === 0) await tx`update runs set status = 'succeeded', finished_at = now() where id = ${runId} and status in ('waiting_review','waiting_approval','running')`;
}

export async function openIncident(tx: Tx, p: { tenantId: string; instanceId?: string; severity: "sev1" | "sev2" | "sev3" | "sev4"; title: string; detail?: string }) {
  const [i] = await tx<{ id: string }[]>`insert into incidents (tenant_id, engine_instance_id, severity, title, detail) values (${p.tenantId}, ${p.instanceId ?? null}, ${p.severity}, ${p.title}, ${p.detail ?? null}) returning id`;
  return i.id;
}

/** Runs a workflow body with standard failure handling: blocked → run blocked; error → run failed + incident. */
export async function execute(ctx: RunCtx, body: () => Promise<Record<string, unknown>>) {
  try {
    const out = await body();
    await finishRun(ctx, "succeeded", out);
    return { ok: true as const, output: out };
  } catch (e) {
    if (e instanceof BlockedError) {
      await finishRun(ctx, "blocked", {}, e.message);
      return { ok: false as const, blocked: true, error: e.message };
    }
    await finishRun(ctx, "failed", {}, (e as Error).message);
    await openIncident(ctx.tx, { tenantId: ctx.tenantId, instanceId: ctx.instanceId, severity: "sev3", title: "Automation run failed", detail: `Run ${ctx.runId}: ${(e as Error).message}` });
    return { ok: false as const, blocked: false, error: (e as Error).message };
  }
}
