"use server";

import { redirect } from "next/navigation";
import { internal } from "@/lib/db";
import type { QuoteLine } from "@/lib/core/quote";
import { provisionClient } from "@/lib/ops/provision";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/security";

export async function acceptQuote(token: string, fd: FormData) {
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const agree = fd.get("agree") === "on";
  const adminEmail = String(fd.get("adminEmail") ?? "").trim().slice(0, 200);
  if (!rateLimit(`accept:${await clientIp()}`, 5, 60 * 60_000).ok) throw new Error("Too many attempts");
  if (name.length < 2 || !agree || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) redirect(`/quote/${token}?error=1`);
  const data = await internal(async (tx) => {
    const [q] = await tx<{ id: string; status: string; lines: QuoteLine[]; term_months: number; totals: { monthly?: number }; opportunity_id: string }[]>`select * from quotes where public_token = ${token} for update`;
    if (!q || q.status !== "sent") return null;
    const [o] = await tx<{ organisation: string | null; name: string }[]>`select c.organisation, o.name from opportunities o left join leads l on l.id = o.lead_id left join contacts c on c.id = l.contact_id where o.id = ${q.opportunity_id}`;
    await tx`update quotes set status = 'accepted', accepted_at = now(), accepted_name = ${`${name}${title ? `, ${title}` : ""}`} where id = ${q.id}`;
    await tx`update opportunities set stage = 'won', updated_at = now() where id = ${q.opportunity_id}`;
    return { q, org: o?.organisation ?? o?.name ?? "New client" };
  });
  if (!data) redirect(`/quote/${token}`);
  const solutions = data.q.lines.map((l) => l.solution).filter(Boolean) as string[];
  const pkg = /scale/i.test(JSON.stringify(data.q.lines)) ? "scale" : /growth/i.test(JSON.stringify(data.q.lines)) ? "growth" : "launch";
  const { tenantId } = await provisionClient({ name: data.org, adminEmail, packageKey: pkg, monthly: Number(data.q.totals?.monthly ?? 0), solutionSlugs: solutions, quoteId: data.q.id });
  await internal(async (tx) => {
    await tx`insert into contracts (tenant_id, quote_id, client_tenant_id, start_date, min_term_months, signed_by, signed_at) values (app_tenant(), ${data.q.id}, ${tenantId}, current_date, ${data.q.term_months}, ${name}, now())`;
    await tx`update opportunities set client_tenant_id = ${tenantId} where id = ${data.q.opportunity_id}`;
    await audit(tx, { tenantId: (await tx`select app_tenant() as t`)[0].t, actorLabel: `client:${name}`, action: "quote.accepted", entity: "quote", entityId: data.q.id, meta: { tenantId } });
  });
  redirect(`/quote/${token}?accepted=1`);
}
