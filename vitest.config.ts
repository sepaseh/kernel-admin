import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    clearMocks: true,
    environment: "node",
    include: ["scripts/run-audit.test.mjs"],
    restoreMocks: true,
    coverage: {
      include: ["scripts/run-audit.mjs"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage/unit",
    },
  },
});
