import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    clearMocks: true,
    environment: "node",
    env: {
      VITE_API_BASE_URL: "http://localhost",
      VITE_OBSERVABILITY_URL: "",
      VITE_RELEASE_ID: "synthetic-storybook-verification",
    },
    setupFiles: [],
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    include: ["scripts/run-audit.test.mjs"],
    restoreMocks: true,
    coverage: {
      include: ["scripts/run-audit.mjs"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage/unit",
      thresholds: {
        branches: 54,
        functions: 59,
        lines: 69,
        statements: 68,
      },
    },
  },
});
