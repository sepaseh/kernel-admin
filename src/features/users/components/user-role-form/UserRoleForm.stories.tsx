import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { UserRoleForm } from "@/features/users/components/user-role-form";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import {
  sampleRoles,
  sampleUsers,
  sampleUser,
} from "../../../../../.storybook/fixtures";

const meta = {
  title: "Features/Users/UserRoleForm",
  component: UserRoleForm,
  args: {
    id: sampleUsers[1].id,
    onFinish: fn(),
    options: { roles: sampleRoles },
  },
  render: (args) => (
    <StoryShell initialEntries={["/users#roles"]}>
      <UserRoleForm {...args} />
    </StoryShell>
  ),
} satisfies Meta<typeof UserRoleForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ExistingSelection: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await waitFor(() =>
      expect(dialog.getByRole("checkbox", { name: "Editor" })).toBeChecked(),
    );
    await expect(
      dialog.getByRole("checkbox", { name: "Administrator" }),
    ).not.toBeChecked();
  },
};
export const SaveSelection: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await waitFor(() =>
      expect(dialog.getByRole("checkbox", { name: "Editor" })).toBeChecked(),
    );
    await userEvent.click(
      dialog.getByRole("checkbox", { name: "Administrator" }),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledOnce());
    await expect(apiClient.put).toHaveBeenCalledWith(
      "/users/user-2/roles",
      {
        roleIds: ["role-admin", "role-editor"],
      },
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};
export const DeniedUpdate: Story = {
  render: (args) => (
    <StoryShell
      initialEntries={["/users#roles"]}
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["users.read"],
      }}
    >
      <UserRoleForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
