import "server-only";
import { z } from "zod";
import { clientIp } from "@/lib/request";
import { rateLimit, verifyTurnstile } from "@/lib/security";
import { DbUnavailableError } from "@/lib/db";
import type { FormState } from "@/components/forms/fields";

export function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

/** Shared guard for public forms: honeypot, rate limit, Turnstile. Returns an error state or null. */
export async function guardPublicForm(fd: FormData, bucket: string, limit = 5, windowMs = 10 * 60_000): Promise<FormState> {
  if (String(fd.get("company_website") ?? "").length > 0) return { ok: true, message: "Thank you." }; // silently drop bots
  const ip = await clientIp();
  const rl = rateLimit(`${bucket}:${ip}`, limit, windowMs);
  if (!rl.ok) return { ok: false, message: "Too many submissions. Please wait a few minutes and try again." };
  const human = await verifyTurnstile(fd.get("cf-turnstile-response") as string | null, ip);
  if (!human) return { ok: false, message: "We could not verify that you are human. Please try again." };
  return null;
}

export function dbErrorState(e: unknown): FormState {
  console.error(e);
  if (e instanceof DbUnavailableError) return { ok: false, message: "Our system is temporarily unavailable, so we could not save your details. Please try again shortly." };
  return { ok: false, message: "Something went wrong on our side. Please try again." };
}

export const str = (max: number, min = 0) => z.string().trim().min(min).max(max);
export const optStr = (max: number) => z.string().trim().max(max).optional().default("");
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
