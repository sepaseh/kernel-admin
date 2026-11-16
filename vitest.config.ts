import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    clearMocks: true,
    environment: "node",
    include: [
      "scripts/run-audit.test.mjs",
      "scripts/check-bundle-size.test.mjs",
      "scripts/lighthouse-policy.test.mjs",
      "scripts/stamp-admin-build.test.mjs",
    ],
    restoreMocks: true,
    coverage: {
      include: [
        "scripts/check-bundle-size.mjs",
        "scripts/lighthouse-policy.mjs",
        "scripts/run-audit.mjs",
        "scripts/stamp-admin-build.mjs",
      ],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage/unit",
    },
  },
});
