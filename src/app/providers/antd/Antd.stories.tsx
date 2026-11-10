import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, ConfigProvider, theme as antdTheme } from "antd";
import { useContext } from "react";
import { expect, within } from "storybook/test";
import { useCore } from "@/app/hooks";
import { AntdProvider } from "@/app/providers";
import { i18n } from "@/shared/i18n";

const AppearanceReadout = () => {
  const { compact, settings, theme } = useCore();
  const { direction } = useContext(ConfigProvider.ConfigContext);
  const { token } = antdTheme.useToken();
  return (
    <section
      aria-label="Story appearance"
      data-testid="appearance-surface"
      style={{ background: token.colorBgBase, color: token.colorTextBase }}
    >
      <p data-testid="core-appearance">
        {settings.language.code}:{settings.language.direction}:
        {settings.language.calendar}:{theme}:{String(compact)}
      </p>
      <p data-testid="antd-direction">{direction}</p>
      <Button>{i18n.t("submit")}</Button>
    </section>
  );
};
const meta = {
  title: "Providers/Antd",
  component: AntdProvider,
  render: () => (
    <AntdProvider>
      <AppearanceReadout />
    </AntdProvider>
  ),
} satisfies Meta<typeof AntdProvider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EnglishLight: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("core-appearance")).toHaveTextContent(
      "en:ltr:gregory:light:false",
    );
    await expect(canvas.getByTestId("antd-direction")).toHaveTextContent("ltr");
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute(
      "lang",
      "en",
    );
    await expect(
      getComputedStyle(canvas.getByTestId("appearance-surface"))
        .backgroundColor,
    ).toBe("rgb(255, 255, 255)");
  },
};
export const PersianDarkCompact: Story = {
  globals: { compact: true, language: "fa", theme: "dark" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("core-appearance")).toHaveTextContent(
      "fa:rtl:jalali:dark:true",
    );
    await expect(canvas.getByTestId("antd-direction")).toHaveTextContent("rtl");
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute(
      "lang",
      "fa",
    );
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute(
      "dir",
      "rtl",
    );
    await expect(
      getComputedStyle(canvas.getByTestId("appearance-surface"))
        .backgroundColor,
    ).toBe("rgb(20, 20, 20)");
  },
};
