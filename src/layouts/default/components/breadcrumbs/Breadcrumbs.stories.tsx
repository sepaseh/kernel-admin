import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter, useLocation } from "react-router";
import { expect, userEvent, within } from "storybook/test";

import { navigationTree } from "@/app/config";
import { Breadcrumbs } from "@/layouts/default/components/breadcrumbs";
import { i18n } from "@/shared/i18n";

const Destination = () => (
  <output aria-label="Selected destination">{useLocation().pathname}</output>
);

const meta = {
  title: "Layouts/Breadcrumbs",
  component: Breadcrumbs,
  args: { currentRoute: "users", items: navigationTree },
  render: (args) => (
    <MemoryRouter initialEntries={["/users"]}>
      <Breadcrumbs {...args} />
      <Destination />
    </MemoryRouter>
  ),
} satisfies Meta<typeof Breadcrumbs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NestedRoute: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const breadcrumb = within(
      canvas.getByRole("navigation", { name: i18n.t("breadcrumb") }),
    );
    await expect(breadcrumb.getByText(i18n.t("userManagement"))).toBeVisible();
    await expect(breadcrumb.getByText(i18n.t("users"))).toBeVisible();
    await userEvent.click(
      breadcrumb.getByRole("link", { name: i18n.t("dashboard") }),
    );

    await expect(
      canvas.getByLabelText("Selected destination"),
    ).toHaveTextContent("/");
  },
};
export const RootRoute: Story = {
  args: { currentRoute: "root" },
  play: async ({ canvasElement }) => {
    const breadcrumb = within(
      within(canvasElement).getByRole("navigation", {
        name: i18n.t("breadcrumb"),
      }),
    );
    await expect(breadcrumb.getByText(i18n.t("dashboard"))).toBeVisible();
    await expect(breadcrumb.queryByRole("link")).not.toBeInTheDocument();
  },
};
export const AccountRoute: Story = {
  args: { currentRoute: "account" },
  play: async ({ canvasElement }) => {
    const breadcrumb = within(
      within(canvasElement).getByRole("navigation", {
        name: i18n.t("breadcrumb"),
      }),
    );
    await expect(breadcrumb.getByText(i18n.t("account"))).toBeVisible();
    await expect(
      breadcrumb.getByRole("link", { name: i18n.t("dashboard") }),
    ).toHaveAttribute("href", "/");
  },
};
export const PersianDark: Story = {
  globals: { language: "fa", theme: "dark" },
  ...NestedRoute,
};
