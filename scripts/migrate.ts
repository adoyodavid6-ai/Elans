/**
 * Applies SQL migrations in db/migrations as the owner role, creates the database and the
 * non-privileged application role (elans_app, NOBYPASSRLS) if they do not exist.
 *   npm run db:migrate          apply pending migrations
 *   npm run db:migrate -- --reset   drop and recreate the database (development only)
 */
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import "./env";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appUrl = process.env.DATABASE_URL;
if (!adminUrl || !appUrl) throw new Error("DATABASE_ADMIN_URL and DATABASE_URL must be set");

const target = new URL(adminUrl);
const dbName = target.pathname.slice(1);
const appRole = decodeURIComponent(new URL(appUrl).username);
const appPassword = decodeURIComponent(new URL(appUrl).password);

async function main() {
  const reset = process.argv.includes("--reset");
  // Hosted Postgres (Neon, Supabase, RDS) usually provides the database already and may not allow
  // connecting to the "postgres" maintenance database, so that step only runs when needed.
  const canReachTarget = await (async () => {
    if (reset) return false;
    const probe = postgres(adminUrl!, { max: 1, onnotice: () => {}, connect_timeout: 15 });
    try {
      await probe`select 1`;
      return true;
    } catch {
      return false;
    } finally {
      await probe.end();
    }
  })();
  if (!canReachTarget) {
    const server = new URL(adminUrl!);
    server.pathname = "/postgres";
    const root = postgres(server.toString(), { max: 1, onnotice: () => {} });
    if (reset) {
      if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Refusing to reset in production");
      await root.unsafe(`drop database if exists "${dbName}" with (force)`);
    }
    const exists = await root`select 1 from pg_database where datname = ${dbName}`;
    if (!exists.length) await root.unsafe(`create database "${dbName}"`);
    await root.end();
  }

  const db = postgres(adminUrl!, { max: 1, onnotice: () => {} });
  const role = await db`select 1 from pg_roles where rolname = ${appRole}`;
  if (!role.length) await db.unsafe(`create role "${appRole}" login password '${appPassword.replace(/'/g, "''")}' nobypassrls`);
  if (appRole === decodeURIComponent(target.username)) console.warn("WARNING: DATABASE_URL uses the owner role, so row-level security is bypassed. Use a separate app role (see README).");
  await db`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const done = await db`select 1 from schema_migrations where name = ${f}`;
    if (done.length) continue;
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    await db.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${f})`;
    });
    console.log(`applied ${f}`);
  }
  await db.unsafe(`
    grant usage on schema public to "${appRole}";
    grant select, insert, update, delete on all tables in schema public to "${appRole}";
    grant usage, select on all sequences in schema public to "${appRole}";
    grant execute on all functions in schema public to "${appRole}";
    revoke all on schema_migrations from "${appRole}";
  `);
  await db.end();
  console.log("migrations complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
