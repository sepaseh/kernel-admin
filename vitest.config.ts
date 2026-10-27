import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    clearMocks: true,
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/run-audit.test.mjs"],
    restoreMocks: true,
    coverage: {
      include: [
        "src/shared/config/language.ts",
        "src/shared/i18n/index.ts",
        "src/shared/i18n/date.ts",
        "src/shared/lib/error.ts",
        "src/shared/api/token.ts",
        "src/shared/contracts/index.ts",
        "src/shared/i18n/catalogs.ts",
        "src/shared/i18n/locales.ts",
        "src/shared/i18n/dayjs/fa.ts",
        "src/shared/i18n/locales/*.ts",
        "src/shared/lib/transform.ts",
        "src/shared/lib/color-contrast.ts",
        "scripts/run-audit.mjs",
      ],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage/unit",
      thresholds: { branches: 54, functions: 59, lines: 69, statements: 68 },
    },
  },
});
