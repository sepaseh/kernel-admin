import "@/assets/styles/index.css";
import "@/assets/styles/vazirmatn.css";
import "@/shared/i18n";

import type { Preview } from "@storybook/react-vite";
import { sb } from "storybook/test";

import { PreviewFrame } from "./PreviewFrame";
import { resetStoryMocks } from "./mocks";

sb.mock(import("../src/shared/api/client.ts"));

const preview: Preview = {
  beforeEach: ({ parameters }) => resetStoryMocks(parameters.fixtureState),
  decorators: [
    (Story, context) => (
      <PreviewFrame
        compact={
          context.globals.compact === true || context.globals.compact === "true"
        }
        direction={
          context.globals.direction === "ltr" ||
          context.globals.direction === "rtl"
            ? context.globals.direction
            : undefined
        }
        languageCode={context.globals.language}
        ownsMain={context.parameters.ownsMain === true}
        themeMode={context.globals.theme}
      >
        <Story />
      </PreviewFrame>
    ),
  ],
  globalTypes: {
    language: {
      description: "Synthetic API language metadata",
      toolbar: {
        items: [
          { title: "English fixture", value: "en" },
          { title: "Persian fixture", value: "fa" },
        ],
      },
    },
    direction: {
      description: "Synthetic API direction metadata",
      toolbar: {
        items: [
          { value: "auto", title: "API fixture" },
          { value: "ltr", title: "LTR" },
          { value: "rtl", title: "RTL" },
        ],
      },
    },
    theme: {
      description: "Ant Design theme",
      toolbar: { items: ["light", "dark"] },
    },
    compact: {
      description: "Compact fixture",
      toolbar: {
        items: [
          { value: "false", title: "Normal" },
          { value: "true", title: "Compact" },
        ],
      },
    },
  },
  initialGlobals: {
    compact: false,
    direction: "auto",
    language: "en",
    theme: "light",
  },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: false }],
      },
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
  },
};

export default preview;
