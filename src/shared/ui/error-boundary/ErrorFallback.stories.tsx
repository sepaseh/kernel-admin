import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ErrorFallback } from "@/shared/ui/error-boundary";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Shared/ErrorFallback",
  component: ErrorFallback,
} satisfies Meta<typeof ErrorFallback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(i18n.t("unexpectedError"))).toBeVisible();
    const reload = canvas.getByRole("button", { name: i18n.t("reload") });
    reload.focus();
    await expect(reload).toHaveFocus();
  },
};
export const PersianDark: Story = {
  ...Default,
  globals: { language: "fa", theme: "dark" },
};
