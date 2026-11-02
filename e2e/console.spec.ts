import "../scripts/env";
import crypto from "node:crypto";
import postgres from "postgres";
import * as OTPAuth from "otpauth";
import { test, expect, isMobile, expectNoSidewaysScroll } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Staff console. Each browser gets its own Super Admin and Admin test accounts with two-step verification
 * already set up (created directly in the database), so browsers don't share sign-in rate limits.
 */
const PASSWORD = "E2E-Console-Pass!2026";
const SECRET = new OTPAuth.Secret({ size: 20 }).base32;
const INTERNAL = "00000000-0000-4000-8000-000000000001";
const hash = (p: string) => { const salt = crypto.randomBytes(16); return `scrypt$16384$${salt.toString("base64url")}$${crypto.scryptSync(p, salt, 64, { N: 16384, r: 8, p: 1 }).toString("base64url")}`; };

async function account(role: "super_admin" | "admin", project: string) {
  const email = `e2e-${role.replace("_", "")}-${project}@elans.test`;
  const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1, onnotice: () => {} });
  try {
    const [u] = await sql<{ id: string }[]>`insert into users (email, name, password_hash, staff_role, mfa_secret, mfa_enabled)
      values (${email}, ${`E2E ${role === "super_admin" ? "Super" : "Admin"} ${project}`}, ${hash(PASSWORD)}, ${role}, ${SECRET}, true)
      on conflict (email) do update set password_hash = excluded.password_hash, staff_role = excluded.staff_role, mfa_secret = excluded.mfa_secret, mfa_enabled = true returning id`;
    await sql`insert into memberships (tenant_id, user_id, role) values (${INTERNAL}, ${u.id}, 'member') on conflict do nothing`;
  } finally { await sql.end(); }
  return email;
}

async function signIn(page: Page, email: string) {
  await page.goto("/ops/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/login\/mfa/);
  await page.getByLabel(/6-digit code/).fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(SECRET) }).generate());
  await page.getByRole("button", { name: /Verify/ }).click();
  await page.waitForURL(/\/ops$/);
}

const CONSOLE = ["/ops", "/ops/leads", "/ops/pipeline", "/ops/bookings", "/ops/bookings?view=list", "/ops/inbox", "/ops/documents",
  "/ops/clients", "/ops/operations", "/ops/billing", "/ops/partners", "/ops/content", "/ops/requests", "/ops/team", "/ops/outbox", "/ops/help"];

test.describe("staff console", () => {
  test.skip(!process.env.DATABASE_ADMIN_URL, "needs DATABASE_ADMIN_URL to create test accounts");

  test("Super Admin: pages, calendar, payments and documents", async ({ page }, info) => {
    await signIn(page, await account("super_admin", info.project.name));
    for (const path of [...CONSOLE, "/ops/payments", "/ops/settings", "/ops/audit", "/ops/documents/templates"]) {
      const res = await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(res?.status(), path).toBeLessThan(400);
      expect(page.url(), `${path} should not be denied`).not.toContain("denied=1");
      await expect(page.locator("h1").first(), path).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
    await page.goto("/ops/bookings");
    await expect(page.getByRole("heading", { name: "Sessions calendar" })).toBeVisible();
    await expect(page.getByText(/45 min/).first()).toBeVisible();
  });

  test("Admin: no Super Admin pages, Ask Super Admin works", async ({ page }, info) => {
    await signIn(page, await account("admin", info.project.name));
    await page.goto("/ops/payments");
    await expect(page).toHaveURL(/denied=1/);
    await page.goto("/ops/team");
    await page.getByRole("button", { name: /Ask Super Admin/ }).click();
    const dialog = page.getByRole("dialog", { name: "Ask the Super Admin" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Note (optional)").fill(`E2E request from ${info.project.name}`);
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Sent to the Super Admin/ })).toBeVisible();
    await page.goto("/ops/requests");
    await expect(page.getByRole("heading", { name: "My requests" })).toBeVisible();
  });

  test("adding a lead and saving its follow-up", async ({ page }, info) => {
    await signIn(page, await account("admin", `${info.project.name}-lead`));
    await page.goto("/ops/leads/new");
    await page.getByLabel("Contact name *").fill(`E2E Lead ${info.project.name}`);
    await page.getByLabel("Email").fill(`e2e-lead-${info.project.name}@example.com`);
    await page.getByRole("button", { name: "Add lead" }).click();
    await page.waitForURL(/\/ops\/leads\/[0-9a-f-]{36}$/);
    await page.waitForLoadState("networkidle");
    const note = `E2E follow-up ${Date.now()}`;
    await page.locator("input[name=nextAction]").last().fill(note);
    await page.getByRole("button", { name: "Save follow-up" }).click();
    await expect(page.getByRole("status").filter({ hasText: /\w/ })).toBeVisible();
    await page.reload();
    await expect(page.locator("input[name=nextAction]").last()).toHaveValue(note);
  });

  test("command palette opens with the keyboard", async ({ page }, info) => {
    test.skip(isMobile(page), "keyboard shortcut is for desktop");
    await signIn(page, await account("admin", `${info.project.name}-kbd`));
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByPlaceholder(/Search|Type/).first()).toBeVisible();
  });
});
