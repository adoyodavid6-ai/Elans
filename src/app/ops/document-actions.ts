"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff, requireSuper } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { queueMessage } from "@/lib/outbox";
import { INTERNAL_TENANT_ID } from "@/lib/db";
import { randomToken } from "@/lib/security";
import { defaultTemplate } from "@/lib/documents/defaults";
import { computeTotals } from "@/lib/documents/compute";
import { nextNumber, templateSchema } from "@/lib/documents/store";
import type { DocKind, DocTemplateConfig } from "@/lib/documents/types";

const KIND = z.enum(["quotation", "contract", "receipt"]);
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ───────────── Templates ─────────────
export async function saveTemplate(id: string, name: string, config: unknown): Promise<{ ok: boolean; message: string }> {
  const u = await requireSuper();
  const p = templateSchema.safeParse(config);
  if (!p.success) return { ok: false, message: `Not saved: ${p.error.issues[0]?.path.join(" › ")} ${p.error.issues[0]?.message}` };
  const nm = name.trim().slice(0, 80);
  if (nm.length < 2) return { ok: false, message: "Give the template a name." };
  await asStaff(u, async (tx) => {
    const [cur] = await tx<{ config: unknown; version: number }[]>`select config, version from doc_templates where id = ${id} for update`;
    if (!cur) throw new Error("Template not found");
    await tx`insert into doc_template_revisions (tenant_id, template_id, version, config, created_by) values (app_tenant(), ${id}, ${cur.version}, ${tx.json(cur.config as never)}, ${u.email})`;
    await tx`update doc_templates set name = ${nm}, config = ${tx.json(p.data as never)}, version = version + 1, updated_by = ${u.email}, updated_at = now() where id = ${id}`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "doc_template.saved", entity: "doc_template", entityId: id });
  });
  revalidatePath("/ops/documents/templates");
  return { ok: true, message: "Template saved. New documents use it; issued documents keep the version they were issued with." };
}

export async function createTemplate(kind: string, fromId: string | null) {
  const u = await requireSuper();
  const k = KIND.parse(kind);
  const id = await asStaff(u, async (tx) => {
    let cfg: DocTemplateConfig = defaultTemplate(k);
    let name = `New ${k}`;
    if (fromId) {
      const [src] = await tx<{ config: DocTemplateConfig; name: string }[]>`select config, name from doc_templates where id = ${fromId} and kind = ${k}`;
      if (src) { cfg = src.config; name = `${src.name} (copy)`; }
    } else {
      const [def] = await tx<{ config: DocTemplateConfig }[]>`select config from doc_templates where kind = ${k} and is_default and not archived`;
      if (def) cfg = { ...defaultTemplate(k), company: def.config.company, payment: def.config.payment, branding: def.config.branding };
    }
    const [t] = await tx<{ id: string }[]>`insert into doc_templates (tenant_id, kind, name, config, updated_by) values (app_tenant(), ${k}, ${name}, ${tx.json(cfg as never)}, ${u.email}) returning id`;
    return t.id;
  });
  await flash(fromId ? "Copy created" : "New template created from the standard layout");
  redirect(`/ops/documents/templates/${id}`);
}

export async function setDefaultTemplate(id: string) {
  const u = await requireSuper();
  await asStaff(u, async (tx) => {
    const [t] = await tx<{ kind: string }[]>`select kind from doc_templates where id = ${id} and not archived`;
    if (!t) return;
    await tx`update doc_templates set is_default = false where kind = ${t.kind} and is_default`;
    await tx`update doc_templates set is_default = true where id = ${id}`;
  });
  await flash("Default template updated");
  revalidatePath("/ops/documents/templates");
}

export async function archiveTemplate(id: string) {
  const u = await requireSuper();
  const ok = await asStaff(u, async (tx) => {
    const [t] = await tx<{ is_default: boolean }[]>`select is_default from doc_templates where id = ${id}`;
    if (!t || t.is_default) return false;
    await tx`update doc_templates set archived = true where id = ${id}`;
    return true;
  });
  await flash(ok ? "Template archived" : "Make another template the default before archiving this one.", ok ? "success" : "error");
  revalidatePath("/ops/documents/templates");
  if (ok) redirect("/ops/documents/templates");
}

export async function restoreTemplateRevision(id: string, revisionId: number) {
  const u = await requireSuper();
  await asStaff(u, async (tx) => {
    const [rev] = await tx<{ config: unknown }[]>`select config from doc_template_revisions where id = ${revisionId} and template_id = ${id}`;
    const [cur] = await tx<{ config: unknown; version: number }[]>`select config, version from doc_templates where id = ${id}`;
    if (!rev || !cur) return;
    await tx`insert into doc_template_revisions (tenant_id, template_id, version, config, created_by) values (app_tenant(), ${id}, ${cur.version}, ${tx.json(cur.config as never)}, ${u.email})`;
    await tx`update doc_templates set config = ${tx.json(rev.config as never)}, version = version + 1, updated_by = ${u.email}, updated_at = now() where id = ${id}`;
  });
  await flash("Earlier version restored");
  revalidatePath(`/ops/documents/templates/${id}`);
}

// ───────────── Documents ─────────────
const lineSchema = z.object({ description: z.string().max(300), details: z.string().max(1000), qty: z.number().min(0).max(1e6), unitPrice: z.number().min(0).max(1e12), discountPct: z.number().min(0).max(100), vat: z.boolean() });
const docSchema = z.object({
  kind: KIND,
  templateId: z.string().uuid(),
  title: z.string().max(160),
  sourceRef: z.string().max(80).nullable(),
  client: z.object({ name: z.string().max(120), organisation: z.string().max(160), email: z.string().max(160), phone: z.string().max(60), address: z.string().max(300), taxPin: z.string().max(40) }),
  data: z.object({
    date: z.string().max(10), secondaryDate: z.string().max(10), reference: z.string().max(80), lines: z.array(lineSchema).max(60), notes: z.string().max(4000),
    startDate: z.string().max(10), termMonths: z.number().int().min(0).max(120), amountReceived: z.number().min(0).max(1e12), method: z.string().max(40), paymentRef: z.string().max(80), forInvoice: z.string().max(80),
    signatories: z.array(z.object({ label: z.string().max(80), name: z.string().max(120), title: z.string().max(120) })).max(4),
  }),
});

export async function saveDocument(id: string | null, payload: unknown): Promise<{ ok: boolean; message: string; id?: string }> {
  const u = await requireStaff();
  const p = docSchema.safeParse(payload);
  if (!p.success) return { ok: false, message: `Not saved: ${p.error.issues[0]?.path.join(" › ")} ${p.error.issues[0]?.message}` };
  const d = p.data;
  if (!d.client.organisation.trim() && !d.client.name.trim()) return { ok: false, message: "Add the client's name or organisation." };
  return asStaff(u, async (tx) => {
    const [t] = await tx<{ config: DocTemplateConfig }[]>`select config from doc_templates where id = ${d.templateId} and kind = ${d.kind}`;
    if (!t) return { ok: false, message: "Template not found." };
    const totals = computeTotals(d.kind, d.data as never, t.config);
    const title = d.title.trim() || `${d.client.organisation || d.client.name}`;
    if (id) {
      const [cur] = await tx<{ status: string }[]>`select status from issued_documents where id = ${id}`;
      if (!cur) return { ok: false, message: "Document not found." };
      if (cur.status !== "draft") return { ok: false, message: "Issued documents can't be edited. Duplicate it to make changes." };
      await tx`update issued_documents set template_id = ${d.templateId}, title = ${title}, client = ${tx.json(d.client)}, data = ${tx.json(d.data as never)}, totals = ${tx.json(totals as never)}, updated_at = now() where id = ${id}`;
      return { ok: true, message: "Draft saved", id };
    }
    const [row] = await tx<{ id: string }[]>`insert into issued_documents (tenant_id, kind, template_id, title, client, data, totals, source_ref, created_by)
      values (app_tenant(), ${d.kind}, ${d.templateId}, ${title}, ${tx.json(d.client)}, ${tx.json(d.data as never)}, ${tx.json(totals as never)}, ${d.sourceRef}, ${u.email}) returning id`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: `document.${d.kind}.created`, entity: "issued_document", entityId: row.id });
    return { ok: true, message: "Draft saved", id: row.id };
  });
}

/** Issues a draft: assigns the next number, freezes the template, creates the private client link. */
export async function issueDocument(id: string) {
  const u = await requireStaff();
  const res = await asStaff(u, async (tx) => {
    const [doc] = await tx<{ kind: DocKind; status: string; template_id: string | null; client: { organisation?: string; name?: string } }[]>`select kind, status, template_id, client from issued_documents where id = ${id} for update`;
    if (!doc || doc.status !== "draft") return { ok: false, message: "Only drafts can be issued." };
    const [t] = await tx<{ config: DocTemplateConfig }[]>`select config from doc_templates where id = ${doc.template_id}`;
    if (!t) return { ok: false, message: "The template for this draft no longer exists. Choose another template and save first." };
    const number = await nextNumber(tx, doc.kind, t.config);
    await tx`update issued_documents set status = 'issued', number = ${number}, snapshot = ${tx.json(t.config as never)}, public_token = ${randomToken(24)}, issued_at = now(), updated_at = now() where id = ${id}`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: `document.${doc.kind}.issued`, entity: "issued_document", entityId: id, meta: { number } });
    return { ok: true, message: `Issued as ${number}. Print it, download a PDF, or send the client link.` };
  });
  await flash(res.message, res.ok ? "success" : "error");
  revalidatePath(`/ops/documents/${id}`);
  revalidatePath("/ops/documents");
}

export async function voidDocument(id: string) {
  const u = await requireSuper();
  await asStaff(u, async (tx) => {
    await tx`update issued_documents set status = 'void', updated_at = now() where id = ${id} and status in ('issued','accepted','draft')`;
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "document.voided", entity: "issued_document", entityId: id });
  });
  await flash("Document voided. Its number stays reserved and the client link stops working.");
  revalidatePath(`/ops/documents/${id}`);
}

export async function duplicateDocument(id: string) {
  const u = await requireStaff();
  const newId = await asStaff(u, async (tx) => {
    const [r] = await tx<{ id: string }[]>`insert into issued_documents (tenant_id, kind, template_id, title, client, data, totals, source_ref, created_by)
      select tenant_id, kind, template_id, title, client, data, totals, source_ref, ${u.email} from issued_documents where id = ${id} returning id`;
    return r?.id;
  });
  await flash("Copy created as a draft");
  redirect(`/ops/documents/${newId}`);
}

export async function emailDocument(id: string, fd: FormData) {
  const u = await requireStaff();
  const to = String(fd.get("to") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    await flash("Enter a valid email address.", "error");
    redirect(`/ops/documents/${id}`);
  }
  const ok = await asStaff(u, async (tx) => {
    const [d] = await tx<{ kind: string; number: string; public_token: string | null; status: string; snapshot: DocTemplateConfig }[]>`select kind, number, public_token, status, snapshot from issued_documents where id = ${id}`;
    if (!d?.public_token || !["issued", "accepted"].includes(d.status)) return false;
    const label = d.kind === "quotation" ? "quotation" : d.kind === "contract" ? "agreement" : "receipt";
    await queueMessage(tx, { channel: "email", to, subject: `Your ${label} ${d.number} from ${d.snapshot.company.name}`, body: `Please find your ${label} ${d.number} here. You can view, download${d.kind !== "receipt" ? " and accept" : ""} it online:\n${siteUrl()}/d/${d.public_token}` });
    await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "document.emailed", entity: "issued_document", entityId: id, meta: { to } });
    return true;
  });
  await flash(ok ? `Sent to ${to}` : "Issue the document before sending it.", ok ? "success" : "error");
  revalidatePath(`/ops/documents/${id}`);
}
