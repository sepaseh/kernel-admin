import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { UsersPage } from "@/features/users";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleUser } from "../../../.storybook/fixtures";

const meta = {
  title: "Features/Users",
  component: UsersPage,
  render: () => (
    <StoryShell initialEntries={["/users"]}>
      <UsersPage />
    </StoryShell>
  ),
} satisfies Meta<typeof UsersPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("row", { name: /Lovelace/ }),
    ).toBeVisible();
    await expect(
      within(canvasElement).getByRole("row", { name: /Hopper/ }),
    ).toBeVisible();
  },
};
export const Empty: Story = { parameters: { fixtureState: "users-empty" } };
export const Loading: Story = { parameters: { fixtureState: "users-loading" } };
export const RequestFailure: Story = {
  parameters: { fixtureState: "users-error" },
  play: async ({ canvasElement }) => {
    const error = await within(canvasElement.ownerDocument.body).findByText(
      "Synthetic users unavailable",
    );
    await waitFor(() => expect(error).toBeVisible());
  },
};
export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["users.read"],
      }}
    >
      <UsersPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("row", { name: /Lovelace/ }),
    ).toBeVisible();
    for (const name of ["create", "update", "delete", "roles"] as const)
      await expect(
        canvas.queryByRole("button", { name: i18n.t(name) }),
      ).not.toBeInTheDocument();
  },
};
export const CreateDrawer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("row", { name: /Lovelace/ });
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("create") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const firstName = dialog.getByLabelText(i18n.t("firstName"));
    await waitFor(() => expect(firstName).toHaveFocus());
    await userEvent.type(firstName, "Katherine");
    await userEvent.type(dialog.getByLabelText(i18n.t("lastName")), "Johnson");
    await userEvent.type(
      dialog.getByLabelText(i18n.t("mobile")),
      "09122222222",
    );
    await expect(
      canvas.getByRole("textbox", { name: i18n.t("firstName") }),
    ).not.toHaveAttribute("id", firstName.id);
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(
      await canvas.findByRole("row", { name: /Johnson/ }),
    ).toBeVisible();
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/users",
      {
        firstName: "Katherine",
        lastName: "Johnson",
        mobile: "09122222222",
        status: "active",
        password: expect.stringMatching(/^.{16}$/),
      },
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("dialog"),
      ).not.toBeInTheDocument(),
    );
  },
};
export const UpdateDrawer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByRole("row", { name: /Hopper/ });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("update") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const firstName = dialog.getByLabelText(i18n.t("firstName"));
    await waitFor(() => expect(firstName).toHaveFocus());
    await expect(firstName).toHaveValue("Grace");
    await expect(dialog.getByLabelText(i18n.t("mobile"))).toHaveValue(
      "09121111111",
    );
  },
};
export const RoleDrawer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByRole("row", { name: /Hopper/ });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("roles") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const editor = await dialog.findByRole("checkbox", { name: "Editor" });
    await waitFor(() => expect(editor).toBeChecked());
    await userEvent.click(
      dialog.getByRole("checkbox", { name: "Administrator" }),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(apiClient.put).toHaveBeenCalledWith(
      "/users/user-2/roles",
      {
        roleIds: ["role-admin", "role-editor"],
      },
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("dialog"),
      ).not.toBeInTheDocument(),
    );
  },
};
