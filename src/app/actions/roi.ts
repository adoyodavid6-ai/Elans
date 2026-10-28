"use server";

import { z } from "zod";
import { getCalculator, sanitiseInputs, ROI_FORMULA_VERSION } from "@/lib/core/roi";
import { internal } from "@/lib/db";
import { captureLead } from "@/lib/leads";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/security";

const schema = z.object({
  calculator: z.string().max(60),
  inputs: z.record(z.string(), z.unknown()),
  currency: z.string().length(3),
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  organisation: z.string().trim().max(160).optional().default(""),
  consentContact: z.literal(true),
  consentMarketing: z.boolean().default(false),
});

export async function saveRoiScenario(input: unknown): Promise<{ ok: boolean; message: string }> {
  const ip = await clientIp();
  if (!rateLimit(`roi:${ip}`, 5, 10 * 60_000).ok) return { ok: false, message: "Too many requests; please try again shortly." };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, message: "Please add your name, a valid email and agree to the privacy notice." };
  const calc = getCalculator(p.data.calculator);
  if (!calc) return { ok: false, message: "Unknown calculator." };
  const inputs = sanitiseInputs(calc, p.data.inputs);
  const result = calc.compute(inputs, p.data.currency);
  try {
    await internal(async (tx) => {
      const { leadId } = await captureLead({ name: p.data.name, email: p.data.email, organisation: p.data.organisation, source: "roi", sourceDetail: calc.name, consentContact: true, consentMarketing: p.data.consentMarketing, consentPurpose: "enquiry" }, tx);
      await tx`insert into roi_scenarios (tenant_id, lead_id, calculator, inputs, outputs, formula_version)
        values (app_tenant(), ${leadId}, ${calc.slug}, ${tx.json(inputs)}, ${tx.json(result.outputs as never)}, ${ROI_FORMULA_VERSION})`;
    });
    return { ok: true, message: "Saved. We have emailed you a copy, and a consultant can walk you through it if you would like." };
  } catch {
    return { ok: false, message: "We could not save this right now. Please try again." };
  }
}
