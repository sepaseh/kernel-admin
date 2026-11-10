import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { RoleForm } from "@/features/roles/components/role-form/RoleForm";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import {
  samplePermissions,
  sampleRoles,
  sampleUser,
} from "../../../../../.storybook/fixtures";

const meta = {
  title: "Features/Roles/RoleForm",
  component: RoleForm,
  args: { onFinish: fn(), options: { permissions: samplePermissions } },
  render: (args) => (
    <StoryShell initialEntries={["/roles#create"]}>
      <RoleForm {...args} />
    </StoryShell>
  ),
} satisfies Meta<typeof RoleForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const name = dialog.getByLabelText(i18n.t("name"));
    await waitFor(() => expect(name).toHaveFocus());
    await userEvent.type(name, "Reviewers");
    await userEvent.click(dialog.getByRole("checkbox", { name: "View users" }));
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledOnce());
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/roles",
      {
        name: "Reviewers",
        permissions: ["users.read"],
      },
      { signal: expect.any(AbortSignal) },
    );
  },
};
export const Update: Story = {
  args: { id: sampleRoles[1].id },
  render: (args) => (
    <StoryShell initialEntries={["/roles#update"]}>
      <RoleForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await waitFor(() =>
      expect(dialog.getByLabelText(i18n.t("name"))).toHaveValue("Editor"),
    );
    await expect(
      dialog.getByRole("checkbox", { name: "View users" }),
    ).toBeChecked();
    await expect(
      dialog.getByRole("checkbox", { name: "Manage users" }),
    ).not.toBeChecked();
  },
};
export const RequiredName: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(dialog.getByLabelText(i18n.t("name"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
export const DeniedCreate: Story = {
  render: (args) => (
    <StoryShell
      initialEntries={["/roles#create"]}
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["roles.read"],
      }}
    >
      <RoleForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
