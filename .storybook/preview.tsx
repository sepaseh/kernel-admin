import "@/assets/styles/index.css";
import "@/assets/styles/vazirmatn.css";
import "@/shared/i18n";

import type { Preview } from "@storybook/react-vite";
import { sb } from "storybook/test";

import { PreviewFrame } from "./PreviewFrame";
import { resetStoryMocks } from "./mocks";

sb.mock(import("../src/features/account/api.ts"));
sb.mock(import("../src/features/auth/api.ts"));
sb.mock(import("../src/features/calendar/api.ts"));
sb.mock(import("../src/features/roles/api.ts"));
sb.mock(import("../src/features/settings/api.ts"));
sb.mock(import("../src/features/settings/components/logo-upload/api.ts"));
sb.mock(import("../src/features/users/api.ts"));
sb.mock(import("../src/shared/api/client.ts"));

const preview: Preview = {
  beforeEach: () => resetStoryMocks(),
  decorators: [
    (Story, context) => (
      <PreviewFrame
        direction={context.globals.direction}
        languageCode={context.globals.language}
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
      description: "Document direction",
      toolbar: { items: ["ltr", "rtl"] },
    },
    theme: {
      description: "Ant Design theme",
      toolbar: { items: ["light", "dark"] },
    },
  },
  initialGlobals: { direction: "ltr", language: "en", theme: "light" },
  parameters: {
    a11y: {
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
