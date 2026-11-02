import { test, expect, isMobile, expectNoSidewaysScroll } from "./fixtures";

const PAGES = [
  "/", "/solutions", "/solutions/tax-compliance/etims-compliance-reconciliation", "/industries", "/industries/healthcare",
  "/growth", "/growth/ai-visibility-check", "/pricing", "/how-it-works", "/about", "/case-studies", "/resources",
  "/resources/whatsapp-agent-buyers-checklist", "/templates", "/integrations", "/partners", "/trust", "/careers",
  "/contact", "/sessions", "/assessment", "/roi/master", "/frontier", "/legal/privacy",
];

test.describe("public pages", () => {
  for (const path of PAGES) {
    test(`renders ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), "HTTP status").toBeLessThan(400);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoSidewaysScroll(page);
    });
  }

  test("unknown pages show the 404 screen", async ({ page }) => {
    const res = await page.goto("/no-such-page-e2e");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /can't find that page/i })).toBeVisible();
  });
});

test.describe("navigation", () => {
  test("main menu opens and links work", async ({ page }) => {
    await page.goto("/");
    if (isMobile(page)) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.locator("#mobile-menu");
      await expect(menu).toBeVisible();
      await menu.getByRole("link", { name: /pricing/i }).first().click();
    } else {
      await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /Solutions/ }).click();
      await expect(page.locator("#menu-solutions")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("link", { name: "Pricing" }).first().click();
    }
    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

test.describe("forms and tools", () => {
  test("contact form sends a message", async ({ page }) => {
    await page.goto("/contact");
    const f = page.locator("main form").first();
    await f.locator("input[name=name]").fill("E2E Tester");
    await f.locator("input[name=email]").fill("e2e@example.com");
    await f.locator("textarea[name=message]").fill("Cross-browser test of the contact form.");
    await f.locator("input[name=consentContact]").check();
    await f.locator("button[type=submit]").click();
    await expect(page.getByText(/Thank you\. We have your message/)).toBeVisible();
  });

  test("contact form blocks an empty submission", async ({ page }) => {
    await page.goto("/contact");
    await page.locator("main form button[type=submit]").first().click();
    expect(await page.locator("main form input[name=email]").evaluate((e: HTMLInputElement) => e.validity.valid)).toBe(false);
  });

  test("ROI calculator recalculates", async ({ page }) => {
    await page.goto("/roi/master");
    const main = page.locator("main");
    const before = await main.innerText();
    await page.locator("main input[type=number]").first().fill("75");
    await expect.poll(async () => (await main.innerText()) !== before).toBe(true);
  });

  test("solutions search filters the catalogue", async ({ page }) => {
    await page.goto("/solutions");
    await page.locator("input[type=search]").first().fill("etims");
    await expect(page.getByRole("link", { name: /eTIMS Compliance/ }).first()).toBeVisible();
  });

  test("chat assistant answers", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open chat with Elans" }).click();
    const dialog = page.getByRole("dialog", { name: "Chat with Elans" });
    await dialog.locator("#chat-input").fill("How much does it cost?");
    await dialog.locator("#chat-input").press("Enter");
    await expect(dialog.getByText(/KES/).first()).toBeVisible();
  });

  test("assessment produces a report", async ({ page }) => {
    await page.goto("/assessment?industry=construction-hardware");
    const cont = () => page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("21–50 people").check(); await cont();
    await page.getByRole("button", { name: "Tax & statutory compliance" }).click(); await cont();
    await page.getByRole("button", { name: "QuickBooks" }).click(); await cont();
    await page.getByRole("button", { name: "Checking supplier invoices for eTIMS" }).click(); await cont();
    await page.getByLabel("Many times a day").check();
    await page.getByLabel("Times per month").fill("600");
    await page.getByLabel("Minutes each time").fill("5");
    await page.getByLabel("People involved").fill("2"); await cont();
    await page.getByLabel("Sometimes").check();
    await page.getByLabel("Serious: penalties, lost revenue or regulatory risk").check(); await cont();
    await cont(); // growth gaps (optional)
    await cont(); // visibility goals (optional)
    await page.getByLabel("Now. It's costing us today").check(); await cont();
    await page.getByLabel("Your name").fill("E2E Tester");
    await page.getByLabel("Work email").fill("e2e-assess@example.com");
    await page.getByLabel("Organisation").fill("E2E Hardware Ltd");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "See my report" }).click();
    await page.waitForURL(/report/, { timeout: 45_000 });
    await expect(page.locator("ol h3").first()).toBeVisible();
  });
});

test.describe("booking", () => {
  type P = import("@playwright/test").Page;
  /** Picks a random free slot and submits; if another browser took it first, reloads and tries another. */
  async function book(page: P, path: string, fill: () => Promise<void>, submit: RegExp) {
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.goto(path);
      const days = page.getByRole("group", { name: "Available days" }).getByRole("button");
      await expect(days.first()).toBeVisible();
      await days.nth(Math.floor(Math.random() * (await days.count()))).click();
      const slots = page.locator("label:has(input[name=slot])");
      await expect(slots.first()).toBeVisible();
      await slots.nth(Math.floor(Math.random() * (await slots.count()))).click();
      await fill();
      await page.locator("input[type=checkbox]").first().check();
      await page.getByRole("button", { name: submit }).click();
      const outcome = await Promise.race([
        page.waitForURL(/confirmation/, { timeout: 30_000 }).then(() => "booked"),
        page.getByText(/just taken that slot|no longer available/).waitFor({ timeout: 30_000 }).then(() => "taken"),
      ]);
      if (outcome === "booked") return;
    }
    throw new Error("Could not find a free slot after 6 attempts");
  }

  test("free Discovery Call can be booked", async ({ page }) => {
    await book(page, "/sessions?type=discovery", async () => {
      await page.getByLabel("Name *").fill("E2E Discovery");
      await page.getByLabel("Work email *").fill("e2e-discovery@example.com");
      await page.getByLabel("Organisation *").fill("E2E Co");
    }, /Confirm booking/);
    await expect(page.getByRole("heading", { name: /You're booked/ })).toBeVisible();
  });

  test("paid Strategy Session books and confirms after test payment", async ({ page }) => {
    await book(page, "/sessions?type=strategy", async () => {
      await page.getByLabel("Name *").fill("E2E Strategy");
      await page.getByLabel("Work email *").fill("e2e-strategy@example.com");
      await page.getByLabel("Organisation *").fill("E2E Strategy Co");
      await page.getByLabel(/Phone \/ M-Pesa number/).fill("0712345678");
    }, /Book and pay/);
    await page.getByRole("button", { name: "Simulate approval" }).click();
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("heading", { name: /You're booked/ })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 25_000 });
  });
});
