import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (
  process.env.CI !== "true" ||
  process.env.KERNEL_QA_CAPTURE !== "1" ||
  process.argv.some((argument) => argument.startsWith("--update-snapshots"))
)
  throw new Error(
    "Only the explicit CI capture-only runner may load this config.",
  );

const repository = fileURLToPath(new URL("../../", import.meta.url));
const product = path.join(repository, "coverage/qa-transport/product");
const require = createRequire(path.join(product, "package.json"));
const { chromium, defineConfig } = require("@playwright/test");
const output = path.join(repository, "coverage/qa-visual");

export default defineConfig({
  testDir: fileURLToPath(new URL("./", import.meta.url)),
  testMatch: "admin.capture.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45_000,
  updateSnapshots: "none",
  expect: { timeout: 10_000 },
  outputDir: path.join(output, "results"),
  reporter: [
    ["line"],
    ["json", { outputFile: path.join(output, "results.json") }],
    ["html", { open: "never", outputFolder: path.join(output, "report") }],
  ],
  projects: [{ name: "pending-pinned-chromium" }],
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
  webServer: {
    command:
      "npm run build && npm run preview -- --host 127.0.0.1 --port 4185 --strictPort",
    cwd: product,
    url: "http://127.0.0.1:4185",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
