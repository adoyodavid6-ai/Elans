import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test gets its own visitor address (X-Forwarded-For), so the site's per-visitor rate limits don't
 * block tests running in parallel across browsers, and every test fails on any uncaught page error.
 */
export const test = base.extend<{ errors: string[] }>({
  context: async ({ context }, use) => {
    const ip = `10.${rand()}.${rand()}.${rand()}`;
    await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
    await use(context);
  },
  errors: [async ({ page }, use) => {
    const errors: string[] = [];
    // console.error capture (development builds explain hydration mismatches here)
    page.on("console", (m) => { if (process.env.E2E_CONSOLE && m.type() === "error") console.log("CONSOLE", m.text().slice(0, 1500)); });
    page.on("pageerror", (e) => errors.push(`${new URL(page.url()).pathname}${new URL(page.url()).search}: ${e.message}`));
    await use(errors);
    expect(errors, "uncaught errors in the page").toEqual([]);
  }, { auto: true }],
});
export { expect };

function rand() { return Math.floor(Math.random() * 250) + 1; }

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

/** The page must not scroll sideways (content wider than the screen). */
export async function expectNoSidewaysScroll(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
  expect(r.sw, `page is ${r.sw}px wide on a ${r.vw}px screen`).toBeLessThanOrEqual(r.vw + 1);
}
