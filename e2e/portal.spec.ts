import { test, expect, expectNoSidewaysScroll } from "./fixtures";

const PORTAL = ["/portal", "/portal/automations", "/portal/conversations", "/portal/health", "/portal/approvals", "/portal/campaigns",
  "/portal/projects", "/portal/reports", "/portal/billing", "/portal/support", "/portal/documents", "/portal/integrations",
  "/portal/team", "/portal/privacy", "/portal/settings"];

test.describe("client portal (demo workspace)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/portal/demo");
    await expect(page.getByText(/Illustrative data/).first()).toBeVisible();
  });

  test("every portal page loads", async ({ page }) => {
    for (const path of PORTAL) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await expect(page.locator("h1").first(), path).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
  });

  test("raising a support ticket shows it with a confirmation", async ({ page }) => {
    await page.goto("/portal/support");
    await page.waitForLoadState("networkidle");
    const subject = `E2E ticket ${Date.now()}`;
    await page.fill("#subject", subject);
    await page.fill("#body", "Cross-browser test ticket");
    await page.getByRole("button", { name: "Raise ticket" }).click();
    await expect(page.getByText(subject).first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /Ticket raised/ })).toBeVisible();
  });

  test("WhatsApp agent simulator replies", async ({ page }) => {
    await page.goto("/portal/conversations");
    await page.waitForLoadState("networkidle");
    await page.fill("#msg", "I want 10 bags of cement");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/bags × Cement/).first()).toBeVisible();
  });
});
