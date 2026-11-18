import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";

import { ErrorBoundary } from "./ErrorBoundary";

const BrokenContent = () => {
  throw new Error("Intentional Storybook error");
};

const meta = {
  component: ErrorBoundary,
  parameters: { layout: "fullscreen" },
  title: "Shared UI/ErrorBoundary",
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  args: { children: <p>Application content</p> },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Application content"),
    ).toBeVisible();
  },
};
export const Fallback: Story = {
  args: { children: <BrokenContent /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(i18nInstance.t("unexpectedError")),
    ).toBeVisible();
    const reload = canvas.getByRole("button", {
      name: i18nInstance.t("reload"),
    });
    reload.focus();
    await expect(reload).toHaveFocus();
  },
};
