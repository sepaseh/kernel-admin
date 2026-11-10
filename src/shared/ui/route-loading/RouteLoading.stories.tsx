import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { RouteLoading } from "@/shared/ui/route-loading";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Shared/RouteLoading",
  component: RouteLoading,
} satisfies Meta<typeof RouteLoading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText(i18n.t("loading")),
    ).toBeVisible();
  },
};
export const PersianDark: Story = {
  globals: { language: "fa", theme: "dark" },
  ...Default,
};
