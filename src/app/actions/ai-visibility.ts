"use server";

import { z } from "zod";
import { internal } from "@/lib/db";
import { captureLead } from "@/lib/leads";
import { aiAvailable, answerWithWebSearch, MODELS } from "@/lib/ai";
import { clientIp } from "@/lib/request";
import { rateLimit, verifyTurnstile } from "@/lib/security";

const schema = z.object({
  brand: z.string().trim().min(2).max(80),
  website: z.string().trim().max(200).optional().default(""),
  category: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(80),
  questions: z.array(z.string().trim().min(8).max(200)).min(1).max(3),
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  consentContact: z.literal(true),
  consentMarketing: z.boolean().default(false),
  turnstile: z.string().optional(),
  honeypot: z.string().optional(),
});

export interface VisibilityResult {
  question: string;
  mentioned: boolean;
  excerpt: string;
  sources: { url: string; title: string }[];
  ownSiteCited: boolean;
}
export type VisibilityResponse =
  | { ok: true; mode: "live"; model: string; checkedAt: string; results: VisibilityResult[] }
  | { ok: true; mode: "manual"; message: string }
  | { ok: false; message: string };

function mentions(text: string, brand: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(text);
  const b = norm(brand).replace(/\b(ltd|limited|plc|inc|kenya|co)\b/g, "").trim();
  return b.length >= 2 && t.includes(b);
}

export async function runVisibilityCheck(input: unknown): Promise<VisibilityResponse> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, message: "Please complete all required fields and agree to the privacy notice." };
  const d = p.data;
  if (d.honeypot) return { ok: false, message: "Rejected." };
  const ip = await clientIp();
  if (!rateLimit(`aivis:${ip}`, 3, 60 * 60_000).ok) return { ok: false, message: "You have run several checks recently. Please try again in an hour." };
  if (!(await verifyTurnstile(d.turnstile, ip))) return { ok: false, message: "We could not verify that you are human." };

  let results: VisibilityResult[] | null = null;
  if (aiAvailable()) {
    results = [];
    for (const q of d.questions) {
      const r = await answerWithWebSearch(q, "public");
      if (!r.ok) {
        results = null;
        break;
      }
      const host = d.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
      results.push({
        question: q,
        mentioned: mentions(r.data.text, d.brand),
        excerpt: r.data.text.slice(0, 700),
        sources: r.data.sources,
        ownSiteCited: Boolean(host) && r.data.sources.some((s) => s.url.toLowerCase().includes(host)),
      });
    }
  }

  try {
    await internal(async (tx) => {
      const { leadId } = await captureLead({ name: d.name, email: d.email, organisation: d.brand, source: "ai_visibility", sourceDetail: `${d.category} · ${d.location}`, consentContact: true, consentMarketing: d.consentMarketing, consentPurpose: "enquiry" }, tx);
      await tx`insert into ai_visibility_checks (tenant_id, lead_id, brand, category, location, queries, results, method)
        values (app_tenant(), ${leadId}, ${d.brand}, ${d.category}, ${d.location}, ${tx.json(d.questions)}, ${tx.json((results ?? []) as never)}, ${results ? `live:${MODELS.primary}+web_search` : "manual_followup"})`;
    });
  } catch {
    if (!results) return { ok: false, message: "We could not save your request right now. Please try again." };
  }
  if (!results) return { ok: true, mode: "manual", message: "The live snapshot is not available right now, so a member of our team will run your questions and email the results within one business day." };
  return { ok: true, mode: "live", model: MODELS.primary, checkedAt: new Date().toISOString(), results };
}
