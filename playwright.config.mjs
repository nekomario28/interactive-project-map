import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: ".tmp/playwright-report" }]]
    : "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile-webkit\.spec\.mjs/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      testMatch: /mobile-webkit\.spec\.mjs/,
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run build:pages && node tests/e2e/server.mjs",
    url: "http://127.0.0.1:4173/",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
