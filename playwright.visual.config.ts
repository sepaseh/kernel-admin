import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, defineConfig } from "@playwright/test";

if (process.env.KERNEL_VISUAL_RUNNER !== "1")
  throw new Error(
    "Run this config through npm run test:visual or test:visual:update.",
  );
if (!["0", "1"].includes(process.env.KERNEL_VISUAL_UPDATE ?? ""))
  throw new Error("The visual runner must declare comparison or capture mode.");

const update = process.env.KERNEL_VISUAL_UPDATE === "1";
if (
  process.env.CI &&
  (update ||
    process.argv.some(
      (arg) => arg.startsWith("--update-snapshots") || arg.startsWith("-u"),
    ))
)
  throw new Error("Visual baseline updates are forbidden in CI.");

const repository = fileURLToPath(new URL("./", import.meta.url));
const baselineDirectory = path.resolve(
  process.env.KERNEL_VISUAL_BASELINES ?? "",
);
const outputDirectory = path.resolve(process.env.KERNEL_VISUAL_RESULTS ?? "");
const expectedBaselines = path.join(
  repository,
  "e2e/visual/baselines/application",
  process.platform,
);
const captures = path.join(repository, "coverage/visual/captures") + path.sep;
const runs = path.join(repository, "coverage/visual") + path.sep + "run-";
if (
  !outputDirectory.startsWith(runs) ||
  (update
    ? !baselineDirectory.startsWith(captures)
    : baselineDirectory !== expectedBaselines)
)
  throw new Error(
    "The visual runner must select owned output and baseline directories.",
  );

export default defineConfig({
  testDir: "./e2e/visual",
  testMatch: "admin.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 45_000,
  updateSnapshots: update ? "all" : "none",
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixels: 40,
    },
  },
  snapshotPathTemplate: path.join(baselineDirectory, "{arg}{ext}"),
  outputDir: outputDirectory,
  reporter: [
    ["list"],
    ["json", { outputFile: `${outputDirectory}-results.json` }],
    ["html", { open: "never", outputFolder: `${outputDirectory}-report` }],
  ],
  projects: [{ name: "pinned-chromium" }],
  use: {
    baseURL: "http://127.0.0.1:4185",
    browserName: "chromium",
    channel: "chromium",
    launchOptions: { executablePath: chromium.executablePath() },
    locale: "en-US",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    colorScheme: "light",
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "npm run build && npm run preview -- --host 127.0.0.1 --port 4185 --strictPort",
      url: "http://127.0.0.1:4185",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
