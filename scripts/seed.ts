/**
 * Seeds the database. Idempotent:
 *  - content items are inserted, and updated only if they have not been edited in the console
 *    (use --force-content to overwrite edits)
 *  - tenants, staff and demo users are created if missing
 *  - demo tenant data is rebuilt each run (it is illustrative by definition)
 */
import "./env";
import postgres from "postgres";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { seed } from "../src/content/seed";
import { DEFAULT_WEIGHTS } from "../src/lib/core/scoring";
import { seedDemoTenant } from "./seed-demo";
import { resolveDbUrls } from "../src/lib/db/urls";

const INTERNAL = "00000000-0000-4000-8000-000000000001";
const DEMO = "00000000-0000-4000-8000-0000000000d1";

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function main() {
  const force = process.argv.includes("--force-content");
  const adminUrl = resolveDbUrls().admin;
  if (!adminUrl) throw new Error("No owner database connection: set DATABASE_ADMIN_URL (or an owner DATABASE_URL plus SESSION_SECRET)");
  const db = postgres(adminUrl, { max: 1, onnotice: () => {} });

  await db.begin(async (tx) => {
    await tx`select set_config('app.auth', 'system', true)`;

    // Tenants
    await tx`insert into tenants (id, name, kind) values (${INTERNAL}, 'Elans', 'internal') on conflict (id) do nothing`;
    await tx`insert into tenants (id, name, kind) values (${DEMO}, 'Demo Hardware & Supplies Ltd (illustrative)', 'demo') on conflict (id) do nothing`;

    // Content
    const groups: [string, { slug?: string; key?: string }[]][] = [
      ["solution", seed.solutions], ["category", seed.categories], ["industry", seed.industries], ["pack", seed.packs],
      ["growth", seed.growthServices], ["frontier", seed.frontierTopics], ["template", seed.templates],
      ["integration", seed.integrations], ["resource", seed.resources], ["example", seed.examples],
      ["package", seed.packages], ["grow_tier", seed.growTiers], ["division", seed.divisions],
    ];
    let n = 0;
    for (const [type, list] of groups) {
      for (const item of list) {
        const slug = (item.slug ?? item.key)!;
        const data = JSON.parse(JSON.stringify(item));
        if (force) {
          await tx`insert into content_items (type, slug, data) values (${type}, ${slug}, ${tx.json(data)})
            on conflict (type, slug) do update set data = excluded.data, edited = false, version = content_items.version + 1, updated_at = now(), updated_by = 'seed'`;
        } else {
          await tx`insert into content_items (type, slug, data) values (${type}, ${slug}, ${tx.json(data)})
            on conflict (type, slug) do update set data = excluded.data, version = content_items.version + 1, updated_at = now(), updated_by = 'seed'
            where content_items.edited = false and content_items.data <> excluded.data`;
        }
        n++;
      }
    }
    for (const p of seed.pricePoints) {
      await tx`insert into price_points (key, label, amount, currency, token, confirmed)
        values (${p.key}, ${p.label}, ${p.amount}, ${p.currency}, ${p.token}, ${p.confirmed}) on conflict (key) do nothing`;
    }
    await tx`insert into site_settings (key, data) values ('site', ${tx.json(JSON.parse(JSON.stringify(seed.settings)))}) on conflict (key) do nothing`;
    const [w] = await tx`select id from score_weight_versions limit 1`;
    if (!w) await tx`insert into score_weight_versions (weights, note, active, created_by) values (${tx.json(DEFAULT_WEIGHTS)}, 'Initial weights (§9.3)', true, 'seed')`;

    // Sources (parsed from SOURCES.md so the file and the CMS stay aligned)
    const md = fs.readFileSync(path.join(process.cwd(), "SOURCES.md"), "utf8");
    for (const line of md.split("\n")) {
      const m = line.match(/^\| (S-\d+) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \| (\w+) \| (.*?) \|$/);
      if (!m) continue;
      const [, id, claim, url, type, , state, notes] = m;
      await tx`insert into sources (id, claim, url, source_type, state, notes) values (${id}, ${claim}, ${url}, ${type}, ${state}, ${notes})
        on conflict (id) do nothing`;
    }

    // Staff users. The default password is for local development only: on a deployed environment
    // (Vercel, or NODE_ENV=production) the admin is created only from ELANS_ADMIN_EMAIL/ELANS_ADMIN_PASSWORD.
    const deployed = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
    const adminEmail = process.env.ELANS_ADMIN_EMAIL ?? "admin@elans.local";
    const envPassword = process.env.ELANS_ADMIN_PASSWORD;
    const [admin] = await tx`select id from users where email = ${adminEmail}`;
    if (!admin) {
      if (deployed && (!envPassword || envPassword.length < 14)) {
        console.warn("skipped staff admin: set ELANS_ADMIN_EMAIL and ELANS_ADMIN_PASSWORD (14+ characters) to create one on a deployed environment");
      } else {
        const adminPassword = envPassword ?? "ElansAdmin!2026";
        const [u] = await tx`insert into users (email, name, password_hash, staff_role) values (${adminEmail}, 'Elans Admin', ${hashPassword(adminPassword)}, 'admin') returning id`;
        await tx`insert into memberships (tenant_id, user_id, role) values (${INTERNAL}, ${u.id}, 'owner')`;
        console.log(`created staff admin ${adminEmail}${envPassword ? "" : ` / ${adminPassword}`}  (MFA enrolment required at first login)`);
      }
    }

    // Demo client user (illustrative tenant only; no MFA requirement for the demo tenant)
    const [demoUser] = await tx`select id from users where email = 'demo@client.example'`;
    if (!demoUser) {
      const [u] = await tx`insert into users (email, name, password_hash) values ('demo@client.example', 'Demo Client', ${hashPassword(crypto.randomBytes(24).toString("hex"))}) returning id`;
      await tx`insert into memberships (tenant_id, user_id, role) values (${DEMO}, ${u.id}, 'approver')`;
    }
    console.log(`content items upserted: ${n}`);
  });

  await seedDemoTenant(db, DEMO);
  await db.end();
  await globalThis.__elansSql?.end();
  console.log("seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
