import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withDb, dbConfigured, DEMO_TENANT_ID } from "@/lib/db";
import { startSession, TENANT_COOKIE } from "@/lib/auth";
import { rateLimit } from "@/lib/security";

/** One-click demo: signs the visitor in to the illustrative demo workspace (no MFA; demo data only). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
  const unavailable = (reason: string) => NextResponse.redirect(new URL(`/portal/login?demo=${reason}`, url));
  if (!rateLimit(`demo:${ip}`, 20, 60 * 60_000).ok) return unavailable("busy");
  // The demo is a real workspace, so it needs the database (and the seeded demo tenant).
  if (!dbConfigured()) return unavailable("no-database");
  let user: { id: string } | undefined;
  try {
    user = await withDb({ system: true }, async (tx) => (await tx<{ id: string }[]>`select id from users where email = 'demo@client.example'`)[0]);
  } catch (e) {
    console.error("[portal/demo] database error", e);
    return unavailable("database-error");
  }
  if (!user) return unavailable("not-seeded");
  await startSession(user.id, false, { ip });
  (await cookies()).set(TENANT_COOKIE, DEMO_TENANT_ID, { path: "/", httpOnly: true, sameSite: "lax", secure: url.protocol === "https:" });
  const dest = next && next.startsWith("/portal") ? next : "/portal";
  return NextResponse.redirect(new URL(dest, url));
}
