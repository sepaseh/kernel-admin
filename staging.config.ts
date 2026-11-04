import { defineConfig, devices } from "@playwright/test";

const stagingUrl = new URL(
  process.env.STAGING_BASE_URL ?? "http://staging-target.invalid/",
);

if (!stagingUrl.pathname.endsWith("/")) {
  stagingUrl.pathname += "/";
}

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: true,
  globalSetup: "./staging/setup.ts",
  globalTimeout: 15 * 60_000,
  outputDir: "coverage/staging/results",
  projects: [
    {
      name: "staging-chromium",
      use: devices["Desktop Chrome"],
    },
    {
      name: "staging-firefox",
      use: devices["Desktop Firefox"],
    },
    {
      name: "staging-webkit",
      use: devices["Desktop Safari"],
    },
    {
      name: "staging-mobile-chromium",
      use: devices["Pixel 7"],
    },
  ],
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: "coverage/staging/report" }],
  ],
  retries: process.env.CI ? 2 : 0,
  testDir: "./staging",
  use: {
    baseURL: stagingUrl.href,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  workers: process.env.CI ? 1 : undefined,
});
