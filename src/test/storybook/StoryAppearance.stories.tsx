import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, ConfigProvider, theme as antdTheme } from "antd";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { expect, within } from "storybook/test";

import { useCore } from "@/app/hooks";

import { StoryShell } from "./StoryShell";

const AppearanceReadout = () => {
  const { language, theme } = useCore();
  const { direction } = useContext(ConfigProvider.ConfigContext);
  const { token } = antdTheme.useToken();
  const { t } = useTranslation();

  return (
    <section
      aria-label="Story appearance"
      data-testid="appearance-surface"
      style={{ backgroundColor: token.colorBgBase, color: token.colorTextBase }}
    >
      <p data-testid="core-appearance">
        {language.code}:{language.direction}:{language.calendar}:{theme}
      </p>
      <p data-testid="antd-direction">{direction}</p>
      <Button>{t("submit")}</Button>
    </section>
  );
};

const meta = {
  render: () => (
    <StoryShell>
      <AppearanceReadout />
    </StoryShell>
  ),
  title: "Test support/Appearance",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const assertAppearance = async (
  canvasElement: HTMLElement,
  expected: {
    background: string;
    core: string;
    direction: "ltr" | "rtl";
    language: "en" | "fa";
    submit: string;
  },
) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByTestId("core-appearance")).toHaveTextContent(
    expected.core,
  );
  await expect(canvas.getByTestId("antd-direction")).toHaveTextContent(
    expected.direction,
  );
  await expect(
    canvas.getByRole("button", { name: expected.submit }),
  ).toBeVisible();
  await expect(
    getComputedStyle(canvas.getByTestId("appearance-surface")).backgroundColor,
  ).toBe(expected.background);
  await expect(document.documentElement).toHaveAttribute(
    "lang",
    expected.language,
  );
  await expect(document.documentElement).toHaveAttribute(
    "dir",
    expected.direction,
  );
};

const lightAppearance = {
  background: "rgb(255, 255, 255)",
  core: "en:ltr:gregorian:light",
  direction: "ltr",
  language: "en",
  submit: "Submit",
} satisfies Parameters<typeof assertAppearance>[1];

export const LtrLight: Story = {
  globals: { direction: "ltr", language: "en", theme: "light" },
  play: ({ canvasElement }) => assertAppearance(canvasElement, lightAppearance),
};

export const MobileLtr: Story = {
  globals: {
    direction: "ltr",
    language: "en",
    theme: "light",
    viewport: { value: "mobile1", isRotated: false },
  },
  play: async ({ canvasElement }) => {
    await assertAppearance(canvasElement, lightAppearance);
    await expect(window.innerWidth).toBe(320);
    await expect(window.innerHeight).toBe(568);
  },
};

export const RtlDark: Story = {
  globals: { direction: "rtl", language: "fa", theme: "dark" },
  play: ({ canvasElement }) =>
    assertAppearance(canvasElement, {
      background: "rgb(0, 0, 0)",
      core: "fa:rtl:jalali:dark",
      direction: "rtl",
      language: "fa",
      submit: "ثبت",
    }),
};
