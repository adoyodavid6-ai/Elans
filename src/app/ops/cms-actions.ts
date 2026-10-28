"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { withDb, INTERNAL_TENANT_ID } from "@/lib/db";
import { invalidateContent, CONTENT_TYPES } from "@/lib/content";
import { CRITERIA } from "@/lib/core/scoring";
import { audit } from "@/lib/audit";

const EDITORS = ["admin", "content_editor"] as const;
const STATUS = z.enum(["live", "pilot", "planned", "custom"]);

/** Minimal structural validation per content type, so a bad edit cannot break public pages. */
const REQUIRED: Record<string, z.ZodType> = {
  solution: z.object({ slug: z.string(), name: z.string().min(3), category: z.string(), division: z.string(), status: STATUS, summary: z.string().min(10), problem: z.string(), capabilities: z.array(z.string()), manualFlow: z.array(z.object({ label: z.string(), kind: z.string() })), automatedFlow: z.array(z.object({ label: z.string(), kind: z.string() })), faqs: z.array(z.object({ q: z.string(), a: z.string() })), pricing: z.object({ approach: z.string(), package: z.string() }), integrations: z.array(z.string()), industries: z.array(z.string()) }).loose(),
  industry: z.object({ slug: z.string(), name: z.string(), short: z.string(), summary: z.string(), solutions: z.array(z.string()) }).loose(),
  growth: z.object({ slug: z.string(), name: z.string(), status: STATUS, summary: z.string(), faqs: z.array(z.object({ q: z.string(), a: z.string() })) }).loose(),
  frontier: z.object({ slug: z.string(), name: z.string(), status: STATUS, summary: z.string() }).loose(),
  integration: z.object({ slug: z.string(), name: z.string(), status: z.enum(["supported", "planned", "custom_assessment"]) }).loose(),
  resource: z.object({ slug: z.string(), title: z.string(), body: z.string(), published: z.string() }).loose(),
};

function staffCtx(u: { id: string; staffRole: string | null }) {
  return { tenantId: INTERNAL_TENANT_ID, userId: u.id, staffRole: u.staffRole };
}

function refresh() {
  invalidateContent();
  revalidatePath("/", "layout");
}

export async function saveContentItem(type: string, slug: string, _: unknown, fd: FormData): Promise<{ ok: boolean; message: string }> {
  const u = await requireStaff([...EDITORS]);
  if (!(type in CONTENT_TYPES)) return { ok: false, message: "Unknown type" };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(String(fd.get("json") ?? ""));
  } catch (e) {
    return { ok: false, message: `JSON error: ${(e as Error).message}` };
  }
  if (typeof data !== "object" || Array.isArray(data) || data === null) return { ok: false, message: "Content must be a JSON object." };
  // Structured fields override the JSON so simple edits don't require touching it.
  for (const k of ["name", "title", "summary", "status"]) {
    const v = fd.get(`f_${k}`);
    if (v !== null && String(v).length) data[k] = String(v);
  }
  const idKey = "slug" in data ? "slug" : "key";
  if (data[idKey] !== slug) return { ok: false, message: `The ${idKey} cannot be changed (it is the URL). Duplicate the item instead.` };
  const schema = REQUIRED[type];
  if (schema) {
    const r = schema.safeParse(data);
    if (!r.success) return { ok: false, message: `Missing or invalid: ${r.error.issues.slice(0, 4).map((i) => i.path.join(".")).join(", ")}` };
  }
  const publish = fd.get("publish_state") === "draft" ? "draft" : "published";
  await withDb(staffCtx(u), async (tx) => {
    const [cur] = await tx<{ data: unknown; version: number }[]>`select data, version from content_items where type = ${type} and slug = ${slug}`;
    if (cur) await tx`insert into content_revisions (type, slug, version, data, created_by) values (${type}, ${slug}, ${cur.version}, ${tx.json(cur.data as never)}, ${u.email})`;
    await tx`insert into content_items (type, slug, data, publish_state, edited, updated_by) values (${type}, ${slug}, ${tx.json(data as never)}, ${publish}, true, ${u.email})
      on conflict (type, slug) do update set data = excluded.data, publish_state = excluded.publish_state, edited = true, version = content_items.version + 1, updated_at = now(), updated_by = excluded.updated_by`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "content.saved", entity: type, entityId: slug, meta: { publish } });
  });
  refresh();
  return { ok: true, message: `Saved and ${publish === "published" ? "published" : "saved as draft"}. The public site updates within a minute.` };
}

export async function duplicateContentItem(type: string, slug: string, fd: FormData) {
  const u = await requireStaff([...EDITORS]);
  const newSlug = String(fd.get("newSlug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  if (newSlug.length < 3) throw new Error("Slug too short");
  await withDb(staffCtx(u), async (tx) => {
    const [cur] = await tx<{ data: Record<string, unknown> }[]>`select data from content_items where type = ${type} and slug = ${slug}`;
    const idKey = "slug" in cur.data ? "slug" : "key";
    const data = { ...cur.data, [idKey]: newSlug, ...(cur.data.name ? { name: `${cur.data.name} (copy)` } : {}), ...(cur.data.status ? { status: "planned" } : {}) };
    await tx`insert into content_items (type, slug, data, publish_state, edited, updated_by) values (${type}, ${newSlug}, ${tx.json(data as never)}, 'draft', true, ${u.email})`;
  });
  refresh();
  redirect(`/ops/content/${type}/${newSlug}`);
}

export async function restoreRevision(type: string, slug: string, revisionId: number) {
  const u = await requireStaff([...EDITORS]);
  await withDb(staffCtx(u), async (tx) => {
    const [rev] = await tx<{ data: unknown }[]>`select data from content_revisions where id = ${revisionId} and type = ${type} and slug = ${slug}`;
    if (!rev) return;
    const [cur] = await tx<{ data: unknown; version: number }[]>`select data, version from content_items where type = ${type} and slug = ${slug}`;
    await tx`insert into content_revisions (type, slug, version, data, created_by) values (${type}, ${slug}, ${cur.version}, ${tx.json(cur.data as never)}, ${u.email})`;
    await tx`update content_items set data = ${tx.json(rev.data as never)}, version = version + 1, edited = true, updated_at = now(), updated_by = ${u.email} where type = ${type} and slug = ${slug}`;
  });
  refresh();
  revalidatePath(`/ops/content/${type}/${slug}`);
}

export async function savePrices(fd: FormData) {
  const u = await requireStaff(["admin"]);
  await withDb(staffCtx(u), async (tx) => {
    const keys = [...new Set([...fd.keys()].filter((k) => k.startsWith("amount:")).map((k) => k.slice(7)))];
    for (const key of keys) {
      const raw = String(fd.get(`amount:${key}`) ?? "").trim();
      const amount = raw === "" ? null : Number(raw);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) continue;
      const confirmed = fd.get(`confirmed:${key}`) === "on";
      await tx`update price_points set amount = ${amount}, confirmed = ${confirmed}, updated_at = now(), updated_by = ${u.email} where key = ${key}`;
    }
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "prices.updated" });
  });
  refresh();
  revalidatePath("/ops/content/prices");
}

export async function saveWeights(fd: FormData) {
  const u = await requireStaff(["admin"]);
  const weights = Object.fromEntries(CRITERIA.map((c) => [c.key, Math.max(0, Math.min(50, Number(fd.get(c.key) ?? 0)))]));
  const note = String(fd.get("note") ?? "").slice(0, 300) || null;
  await withDb(staffCtx(u), async (tx) => {
    await tx`update score_weight_versions set active = false where active`;
    await tx`insert into score_weight_versions (weights, note, active, created_by) values (${tx.json(weights)}, ${note}, true, ${u.email})`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "weights.new_version", meta: weights });
  });
  refresh();
  revalidatePath("/ops/content/weights");
}

export async function activateWeights(id: number) {
  const u = await requireStaff(["admin"]);
  await withDb(staffCtx(u), async (tx) => {
    await tx`update score_weight_versions set active = (id = ${id})`;
  });
  refresh();
  revalidatePath("/ops/content/weights");
}

export async function saveSource(id: string, fd: FormData) {
  const u = await requireStaff([...EDITORS]);
  const state = String(fd.get("state"));
  if (!["unverified", "verified", "vendor_estimate"].includes(state)) return;
  await withDb(staffCtx(u), (tx) => tx`update sources set state = ${state}, accessed_on = ${String(fd.get("accessed_on") ?? "") || null}, notes = ${String(fd.get("notes") ?? "").slice(0, 1000)} where id = ${id}`);
  revalidatePath("/ops/content/sources");
}

export async function saveSettings(fd: FormData) {
  const u = await requireStaff(["admin"]);
  const s = {
    legalEntity: String(fd.get("legalEntity") ?? "") || null,
    registrationNo: String(fd.get("registrationNo") ?? "") || null,
    odpcRegistration: String(fd.get("odpcRegistration") ?? "") || null,
    email: String(fd.get("email") ?? "") || null,
    phone: String(fd.get("phone") ?? "") || null,
    whatsapp: String(fd.get("whatsapp") ?? "") || null,
    address: String(fd.get("address") ?? "") || null,
    domain: String(fd.get("domain") ?? "") || "{{DOMAIN}}",
    supportHours: String(fd.get("supportHours") ?? ""),
    supportHoursConfirmed: fd.get("supportHoursConfirmed") === "on",
    marketScope: String(fd.get("marketScope") ?? ""),
    caseStudyDate: String(fd.get("caseStudyDate") ?? "") || null,
    discoveryCallFree: fd.get("discoveryCallFree") === "on",
    marginFloor: Math.min(0.95, Math.max(0, Number(fd.get("marginFloor") ?? 65) / 100)),
    minTermMonths: Math.max(1, Math.min(60, Number(fd.get("minTermMonths") ?? 6))),
  };
  await withDb(staffCtx(u), async (tx) => {
    await tx`update site_settings set data = data || ${tx.json(s as never)}, updated_at = now(), updated_by = ${u.email} where key = 'site'`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "settings.updated" });
  });
  refresh();
  revalidatePath("/ops/settings");
}
