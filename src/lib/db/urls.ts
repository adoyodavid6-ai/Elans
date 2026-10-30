import crypto from "node:crypto";

/**
 * Resolves the two database connections from the environment (shared by the app and the scripts).
 *
 *  - app:   used at runtime; must be a role that cannot bypass row-level security.
 *  - admin: owner role, used only by migrations and the seed.
 *
 * Explicit setup: DATABASE_URL (app role) + DATABASE_ADMIN_URL (owner).
 * Integration setup (e.g. Vercel's Neon integration, which sets only an owner DATABASE_URL): when
 * DATABASE_ADMIN_URL is absent and DATABASE_URL is not the app role, DATABASE_URL is treated as the owner
 * and the app connects as ELANS_DB_APP_ROLE (default "elans_app") on the same host, with a password derived
 * from SESSION_SECRET. Migrations create that role with the same derived password.
 */
export interface DbUrls {
  app: string | null;
  admin: string | null;
  appRole: string;
  derived: boolean;
}

export function resolveDbUrls(env: NodeJS.ProcessEnv = process.env): DbUrls {
  const appRole = env.ELANS_DB_APP_ROLE || "elans_app";
  const url = env.DATABASE_URL || null;
  const admin = env.DATABASE_ADMIN_URL || null;
  if (!url) return { app: null, admin, appRole, derived: false };
  if (admin) return { app: url, admin, appRole: decodeURIComponent(new URL(url).username), derived: false };
  const user = decodeURIComponent(new URL(url).username);
  if (user === appRole) return { app: url, admin: null, appRole, derived: false };
  // Migrations prefer a direct (unpooled) connection when the provider supplies one (Neon does).
  const owner = env.DATABASE_URL_UNPOOLED || url;
  if (!env.SESSION_SECRET) return { app: null, admin: owner, appRole, derived: true }; // cannot derive safely
  const app = new URL(url);
  app.username = encodeURIComponent(appRole);
  app.password = derivedAppPassword(env.SESSION_SECRET);
  return { app: app.toString(), admin: owner, appRole, derived: true };
}

export function derivedAppPassword(secret: string) {
  return crypto.createHmac("sha256", secret).update("elans-db-app-role-v1").digest("hex");
}
