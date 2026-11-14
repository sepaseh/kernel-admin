import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { updateUserRoles } from "@/features/users/api";
import { roles, user } from "@/test/storybook/fixtures";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { UserRoleForm } from "./UserRoleForm";

const meta = {
  args: {
    id: user.id,
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
    const administrator = await dialog.findByRole("checkbox", {
      name: "Administrator",
    });
    await waitFor(() => expect(administrator).toBeChecked());
    await userEvent.click(dialog.getByRole("checkbox", { name: "Editor" }));
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
    await waitFor(() => {
      expect(body.queryByRole("dialog")).not.toBeInTheDocument();
      expect(body.queryByRole("listbox")).not.toBeInTheDocument();
    });
  },
};
