import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./.storybook/vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      storybookTest({
        configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
      }),
    ],
    test: {
      fileParallelism: false,
      name: "storybook",
      coverage: {
        enabled: true,
        provider: "v8",
        reporter: ["text-summary", "lcov", "json-summary"],
        reportsDirectory: "coverage/storybook",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/**/*.stories.tsx",
          "src/**/*.d.ts",
          "src/test/**",
        ],
      },
      browser: {
        enabled: true,
        headless: true,
        instances: [{ browser: "chromium" }],
        provider: playwright(),
      },
      setupFiles: ["./.storybook/vitest.setup.ts"],
    },
  }),
);
