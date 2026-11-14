import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, userEvent, within } from "storybook/test";
import { DefaultLayout } from "@/layouts/default";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Layouts/Default",
  component: DefaultLayout,
  parameters: { ownsMain: true },
  render: () => (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<DefaultLayout />}>
          <Route index element={<h2>Dashboard content</h2>} />
        </Route>
        <Route path="/auth" element={<p>Signed out destination</p>} />
      </Routes>
    </MemoryRouter>
  ),
} satisfies Meta<typeof DefaultLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { name: "Dashboard content" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: i18n.t("account") }),
    ).toBeVisible();
  },
};
export const LoadingAccount: Story = {
  parameters: { fixtureState: "account-loading" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("heading", {
        name: "Dashboard content",
      }),
    ).not.toBeInTheDocument();
    await expect(
      within(canvasElement.ownerDocument.body).getByLabelText(
        i18n.t("loading"),
      ),
    ).toBeVisible();
  },
};
export const AccountFailure: Story = {
  parameters: { fixtureState: "account-error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(i18n.t("currentUserLoadFailed")),
    ).toBeVisible();
    await expect(
      within(canvasElement.ownerDocument.body).queryByLabelText(
        i18n.t("loading"),
      ),
    ).not.toBeInTheDocument();
  },
};
export const Logout: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Dashboard content" });
    await userEvent.hover(
      canvas.getByRole("button", { name: i18n.t("account") }),
    );
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByText(
        i18n.t("logout"),
      ),
    );
    await expect(
      await canvas.findByText("Signed out destination"),
    ).toBeVisible();
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/logout",
      undefined,
      {
        signal: undefined,
      },
    );
  },
};
export const PersianDark: Story = {
  globals: { language: "fa", theme: "dark" },
  ...Desktop,
};
