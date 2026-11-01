import "server-only";
import { z } from "zod";
import type { Tx } from "@/lib/db";
import { getCatalogue } from "@/lib/content";
import { defaultTemplate } from "./defaults";
import { formatNumber } from "./compute";
import type { DocKind, DocTemplateConfig } from "./types";

export interface TemplateRow { id: string; kind: DocKind; name: string; is_default: boolean; config: DocTemplateConfig; version: number; updated_by: string | null; updated_at: Date }

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const str = (max: number) => z.string().max(max).default("");
export const templateSchema = z.object({
  title: z.string().trim().min(1).max(60),
  branding: z.object({ accent: hex, accent2: hex, showLogo: z.boolean(), logoText: str(6), headerStyle: z.enum(["split", "stacked", "band"]), font: z.enum(["sans", "serif"]), blendLine: z.boolean(), paper: z.enum(["A4", "Letter"]) }),
  company: z.object({ name: z.string().trim().min(1).max(120), tagline: str(160), address: str(300), email: str(160), phone: str(60), website: str(160), taxPin: str(40), registrationNo: str(60) }),
  numbering: z.object({ prefix: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9/]+$/, "Prefix: letters, numbers or /"), pad: z.number().int().min(1).max(8), includeYear: z.boolean() }),
  money: z.object({ currency: z.string().trim().min(3).max(3), vatEnabled: z.boolean(), vatRate: z.number().min(0).max(50), pricesIncludeVat: z.boolean() }),
  payment: z.object({ mpesaPaybill: str(20), mpesaAccount: str(60), mpesaTill: str(20), bankName: str(120), bankAccountName: str(120), bankAccountNumber: str(60), bankBranch: str(120), swift: str(20), instructions: str(500) }),
  labels: z.object({ from: str(40), to: str(40), number: str(40), date: str(40), secondaryDate: str(40) }),
  validityDays: z.number().int().min(0).max(365),
  sections: z.array(z.object({
    id: z.string().min(1).max(40), type: z.enum(["parties", "text", "lineItems", "totals", "payment", "terms", "signatures", "divider"]),
    title: str(120), body: str(20000), visible: z.boolean(), signatories: z.array(z.object({ label: z.string().max(80) })).max(4).optional(),
  })).max(40),
  footer: str(400),
});

/** Creates the three default templates the first time the Documents area is used, using the site's company details. */
export async function ensureDefaultTemplates(tx: Tx, actor: string) {
  const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from doc_templates`;
  if (n > 0) return;
  const s = (await getCatalogue()).settings;
  for (const kind of ["quotation", "contract", "receipt"] as DocKind[]) {
    const cfg = defaultTemplate(kind);
    cfg.company = { ...cfg.company, name: s.legalEntity || s.brand || cfg.company.name, email: s.email ?? "", phone: s.phone ?? "", address: s.address ?? cfg.company.address, registrationNo: s.registrationNo ?? "", tagline: s.tagline || cfg.company.tagline };
    await tx`insert into doc_templates (tenant_id, kind, name, is_default, config, updated_by) values (app_tenant(), ${kind}, ${`Standard ${kind}`}, true, ${tx.json(cfg as never)}, ${actor})`;
  }
}

export async function listTemplates(tx: Tx, kind?: DocKind) {
  return tx<TemplateRow[]>`select id, kind, name, is_default, config, version, updated_by, updated_at from doc_templates where not archived and (${kind ?? null}::text is null or kind = ${kind ?? null}) order by kind, is_default desc, name`;
}

/** Next number for a kind, from the issuing template's scheme. Counter rows lock per kind and year. */
export async function nextNumber(tx: Tx, kind: DocKind, cfg: DocTemplateConfig) {
  const year = new Date().getFullYear();
  const [row] = await tx<{ next: number }[]>`
    insert into doc_counters (tenant_id, kind, year, next) values (app_tenant(), ${kind}, ${year}, 2)
    on conflict (tenant_id, kind, year) do update set next = doc_counters.next + 1
    returning next - 1 as next`;
  return formatNumber(cfg, row.next, year);
}
