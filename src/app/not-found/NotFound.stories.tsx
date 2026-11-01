import type { Meta, StoryObj } from "@storybook/react-vite";
import { Route, Routes } from "react-router";
import { expect, userEvent, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { NotFoundPage } from "./NotFound";

const meta = {
  component: NotFoundPage,
  render: () => (
    <StoryShell initialEntries={["/missing"]}>
      <Routes>
        <Route element={<h1>Home destination</h1>} path="/" />
        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </StoryShell>
  ),
  title: "App/NotFound",
} satisfies Meta<typeof NotFoundPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const home = canvas.getByRole("button", {
      name: i18nInstance.t("backHome"),
    });
    await expect(canvas.getAllByRole("button")).toHaveLength(1);
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
    home.focus();
    await expect(home).toHaveFocus();
  },
};

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const home = canvas.getByRole("button", {
      name: i18nInstance.t("backHome"),
    });
    home.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      await canvas.findByRole("heading", { name: "Home destination" }),
    ).toBeVisible();
  },
};
