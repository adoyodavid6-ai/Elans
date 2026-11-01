import "server-only";
import { cookies } from "next/headers";

/**
 * One-shot confirmation messages for server actions ("Lead saved", "Invoice issued").
 * Stored in a short-lived, non-sensitive cookie that the app shell reads and the toast clears.
 */
export const FLASH_COOKIE = "elans_flash";
export type FlashTone = "success" | "error" | "info";

export async function flash(message: string, tone: FlashTone = "success") {
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(JSON.stringify({ m: message.slice(0, 200), t: tone, id: Date.now() })), { path: "/", maxAge: 30, sameSite: "lax" });
}

export async function readFlash(): Promise<{ m: string; t: FlashTone; id: number } | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return typeof v?.m === "string" ? { m: v.m, t: ["success", "error", "info"].includes(v.t) ? v.t : "info", id: Number(v.id) || 0 } : null;
  } catch {
    return null;
  }
}
