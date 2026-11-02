import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-browser end-to-end tests: Chromium, Firefox and WebKit (Safari's engine) on desktop, plus iPhone (WebKit)
 * and Android (Chromium) phones. Runs against E2E_BASE_URL, or starts the built app locally (`npm run build` first).
 *   npm run e2e                      all browsers
 *   npx playwright test --project=webkit
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  timeout: 150_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // macOS runners are smaller: fewer parallel browsers so pages aren't starved of CPU.
  workers: process.env.CI ? (process.platform === "darwin" ? 2 : 3) : 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["github"]] : [["list"]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", actionTimeout: 20_000, navigationTimeout: process.env.CI ? 90_000 : 45_000 },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run start", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
