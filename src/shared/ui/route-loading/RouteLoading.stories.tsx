import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";

import { RouteLoading } from "./RouteLoading";

const meta = {
  component: RouteLoading,
  parameters: { layout: "fullscreen" },
  title: "Shared UI/RouteLoading",
} satisfies Meta<typeof RouteLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("status", {
        name: i18nInstance.t("loading"),
      }),
    ).toBeInTheDocument();
  },
};
