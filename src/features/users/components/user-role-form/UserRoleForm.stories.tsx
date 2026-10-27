import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { updateUserRoles } from "@/features/users/api";
import { roles, user } from "@/test/storybook/fixtures";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { UserRoleForm } from "./UserRoleForm";

const meta = {
  args: {
    data: user,
    onFinish: fn(),
    options: { roles },
  },
  component: UserRoleForm,
  render: (args) => (
    <StoryShell initialEntries={["/#roles"]}>
      <UserRoleForm {...args} />
    </StoryShell>
  ),
  title: "Features/Users/UserRoleForm",
} satisfies Meta<typeof UserRoleForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await expect(dialog.getByText("Administrator")).toBeVisible();
    await userEvent.click(
      dialog.getByRole("combobox", { name: i18nInstance.t("roles") }),
    );
    await userEvent.click(await body.findByText("Editor"));
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await waitFor(() =>
      expect(updateUserRoles).toHaveBeenCalledWith(
        "user-1",
        { roleIds: ["role-admin", "role-editor"] },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledTimes(1));
  },
};
