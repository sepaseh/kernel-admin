import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Storybook measures Chromium source coverage without excluding production modules", () => {
  const loaded = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const { default: configuration } = await import(process.argv[1]);
       const { coverage, browser } = configuration.test;
       process.stdout.write(JSON.stringify({
         envDir: configuration.envDir,
         test: { coverage, browser: {
           enabled: browser.enabled,
           headless: browser.headless,
           instances: browser.instances,
         } },
       }));`,
      new URL("../vitest.storybook.config.ts", import.meta.url).href,
    ],
    {
      env: {
        ...process.env,
        VITEST: "0",
        STORYBOOK_DISABLE_TELEMETRY: "1",
      },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(loaded.status, 0, loaded.stderr);
  const configuration = JSON.parse(loaded.stdout);
  const { coverage, browser } = configuration.test;
  assert.equal(configuration.envDir, false);
  assert.equal(coverage.enabled, true);
  assert.equal(coverage.provider, "v8");
  assert.ok(
    coverage.reporter.some(
      (reporter) =>
        (Array.isArray(reporter) ? reporter[0] : reporter) === "lcov",
    ),
  );
  assert.equal(coverage.reportsDirectory, "coverage/storybook");
  assert.deepEqual(coverage.include, ["src/**/*.{ts,tsx}"]);
  assert.deepEqual(
    new Set(coverage.exclude),
    new Set([
      "src/**/*.test.{ts,tsx}",
      "src/**/*.stories.tsx",
      "src/**/*.d.ts",
      "src/test/**",
    ]),
  );
  assert.equal(browser.enabled, true);
  assert.equal(browser.headless, true);
  assert.deepEqual(browser.instances, [{ browser: "chromium" }]);
});
