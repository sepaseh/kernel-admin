import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  core: {
    builder: {
      name: "@storybook/builder-vite",
      options: {
        viteConfigPath: fileURLToPath(
          new URL("./vite.config.ts", import.meta.url),
        ),
      },
    },
    disableTelemetry: true,
  },
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-vitest",
  ],
  framework: "@storybook/react-vite",
  staticDirs: ["../public"],
  stories: ["../src/**/*.stories.@(ts|tsx)"],
};

export default config;
