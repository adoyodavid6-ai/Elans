"use server";

import { redirect } from "next/navigation";
import { withDb } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/security";

/** Client accepts a quotation or contract from its private link. Recorded with name, time and IP. */
export async function acceptDocument(token: string, fd: FormData) {
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const agree = fd.get("agree") === "on";
  const ip = await clientIp();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) redirect("/");
  if (!rateLimit(`doc-accept:${ip}`, 10, 60 * 60_000).ok || name.length < 2 || !agree) redirect(`/d/${token}?error=1`);
  const ok = await withDb({}, async (tx) => (await tx<{ ok: boolean }[]>`select accept_public_document(${token}, ${name}, ${ip}) as ok`)[0]?.ok);
  redirect(`/d/${token}${ok ? "?accepted=1" : "?error=1"}`);
}
