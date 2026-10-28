import "server-only";
import crypto from "node:crypto";

/** Small, dependency-free security helpers: hashing, HMAC signing, constant-time compare, rate limiting. */

export function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be at least 32 characters");
    return "dev-only-insecure-secret-change-me-0000000000";
  }
  return s;
}

export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export function sign(value: string): string {
  const mac = crypto.createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}
export function unsign(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const expected = sign(value);
  const a = Buffer.from(signed);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? value : null;
}

// ── Passwords (scrypt) ──
const N = 16384;
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length, { N: Number(n), r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

// ── Rate limiting (in-memory, per instance; use a shared store in multi-instance production) ──
type Bucket = { tokens: number; at: number };
declare global {
  // eslint-disable-next-line no-var
  var __elansRate: Map<string, Bucket> | undefined;
}
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const store = (globalThis.__elansRate ??= new Map());
  const now = Date.now();
  const b = store.get(key) ?? { tokens: limit, at: now };
  const refill = ((now - b.at) / windowMs) * limit;
  b.tokens = Math.min(limit, b.tokens + refill);
  b.at = now;
  if (b.tokens < 1) {
    store.set(key, b);
    return { ok: false, retryAfterMs: Math.ceil(((1 - b.tokens) / limit) * windowMs) };
  }
  b.tokens -= 1;
  store.set(key, b);
  if (store.size > 10_000) for (const k of [...store.keys()].slice(0, 2000)) store.delete(k);
  return { ok: true, retryAfterMs: 0 };
}

/** Cloudflare Turnstile verification. Disabled (returns true) when no secret is configured. */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
