import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withDb, DEMO_TENANT_ID } from "@/lib/db";
import { startSession, TENANT_COOKIE } from "@/lib/auth";
import { rateLimit } from "@/lib/security";

/** One-click demo: signs the visitor in to the illustrative demo workspace (no MFA; demo data only). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
  if (!rateLimit(`demo:${ip}`, 20, 60 * 60_000).ok) return NextResponse.redirect(new URL("/portal/login", url));
  const user = await withDb({ system: true }, async (tx) => (await tx<{ id: string }[]>`select id from users where email = 'demo@client.example'`)[0]);
  if (!user) return NextResponse.redirect(new URL("/portal/login", url));
  await startSession(user.id, false, { ip });
  (await cookies()).set(TENANT_COOKIE, DEMO_TENANT_ID, { path: "/", httpOnly: true, sameSite: "lax" });
  const dest = next && next.startsWith("/portal") ? next : "/portal";
  return NextResponse.redirect(new URL(dest, url));
}
