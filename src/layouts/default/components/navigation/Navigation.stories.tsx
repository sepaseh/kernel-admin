import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter, useLocation } from "react-router";
import { expect, userEvent, within } from "storybook/test";

import { navigationTree } from "@/app/config";
import { Navigation } from "@/layouts/default/components/navigation";
import { i18n } from "@/shared/i18n";

const Destination = () => (
  <output aria-label="Selected destination">{useLocation().pathname}</output>
);

const meta = {
  title: "Layouts/Navigation",
  component: Navigation,
  args: { currentRoute: "users", items: navigationTree, mode: "inline" },
  render: (args) => (
    <MemoryRouter initialEntries={["/users"]}>
      <nav
        aria-label={i18n.t("menu")}
        style={{ width: args.mode === "inline" ? 280 : "100%" }}
      >
        <Navigation {...args} />
      </nav>
      <Destination />
    </MemoryRouter>
  ),
} satisfies Meta<typeof Navigation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText(i18n.t("userManagement")));
    const roles = await canvas.findByRole("link", { name: i18n.t("roles") });
    await expect(roles).toHaveAttribute("href", "/roles");
    await userEvent.click(roles);

    await expect(
      canvas.getByLabelText("Selected destination"),
    ).toHaveTextContent("/roles");
  },
};
export const Horizontal: Story = {
  args: { mode: "horizontal" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: i18n.t("dashboard") }),
    ).toHaveAttribute("href", "/");
  },
};
export const PersianDark: Story = {
  globals: { language: "fa", theme: "dark" },
  ...Inline,
};
