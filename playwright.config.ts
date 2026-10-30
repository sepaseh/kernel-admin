import { createRequire } from "node:module";

import type { LaunchOptions } from "@playwright/test";
import { defineConfig, devices } from "@playwright/test";

const { windowsChromiumLaunchOptions } = createRequire(import.meta.url)(
  "./scripts/visual-environment.mjs",
) as { windowsChromiumLaunchOptions: () => LaunchOptions };

const baseURL = "http://127.0.0.1:4185";

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  outputDir: "coverage/e2e/results",
  projects: [
    {
      name: "chromium",
      testIgnore: [/visual\.spec\.ts/, /[\\/]visual[\\/]/],
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: windowsChromiumLaunchOptions(),
      },
    },
    {
      name: "firefox",
      testIgnore: [/visual\.spec\.ts/, /[\\/]visual[\\/]/],
      use: devices["Desktop Firefox"],
    },
    {
      name: "webkit",
      testIgnore: [/visual\.spec\.ts/, /[\\/]visual[\\/]/],
      use: devices["Desktop Safari"],
    },
    {
      name: "mobile-chromium",
      testIgnore: [/visual\.spec\.ts/, /[\\/]visual[\\/]/],
      use: {
        ...devices["Pixel 7"],
        launchOptions: windowsChromiumLaunchOptions(),
      },
    },
  ],
  reporter: [
    [process.env.CI ? "line" : "list"],
    ["json", { outputFile: "coverage/e2e/results.json" }],
    ["html", { open: "never", outputFolder: "coverage/e2e/report" }],
  ],
  retries: 0,
  testDir: "./e2e",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  webServer: {
    command:
      "npm run build && npm run preview -- --host 127.0.0.1 --port 4185 --strictPort",
    env: {
      ...process.env,
      KERNEL_SYNTHETIC_ENV: "1",
      VITE_API_BASE_URL: "https://api.example.com",
      VITE_APP_BASE_URL: "/",
      VITE_OBSERVABILITY_URL: "",
      VITE_RELEASE_ID: "e2e",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  workers: process.env.CI ? 1 : undefined,
});
