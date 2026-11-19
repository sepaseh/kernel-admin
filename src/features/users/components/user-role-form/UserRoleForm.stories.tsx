import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useCallback } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { apiClient } from "@/shared/api";
import { useGoBack } from "@/shared/hooks";
import { i18nInstance } from "@/shared/i18n";

import { roles, sampleAccount, user } from "../../../../../.storybook/fixtures";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import { UserRoleForm } from "./UserRoleForm";

type RoutedUserRoleFormProps = ComponentProps<typeof UserRoleForm>;

const RoutedUserRoleForm = ({
  onClose,
  onFinish,
  ...args
}: RoutedUserRoleFormProps) => {
  const goBack = useGoBack();
  const handleClose = useCallback(() => {
    onClose();
    goBack();
  }, [goBack, onClose]);
  const handleFinish = () => {
    onFinish();
    goBack();
  };

  return (
    <UserRoleForm {...args} onClose={handleClose} onFinish={handleFinish} />
  );
};

const meta = {
  args: {
    id: user.id,
    onClose: fn(),
    onFinish: fn(),
    options: { roles },
  },
  component: UserRoleForm,
  render: (args) => (
    <StoryShell initialEntries={["/#roles"]}>
      <RoutedUserRoleForm {...args} />
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
      expect(apiClient.put).toHaveBeenCalledWith(
        "/users/user-1/roles",
        { roleIds: ["role-admin", "role-editor"] },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(body.queryByRole("dialog")).not.toBeInTheDocument();
      expect(body.queryByRole("listbox")).not.toBeInTheDocument();
    });
  },
};

export const DeniedUpdate: Story = {
  render: (args) => (
    <StoryShell
      initialEntries={["/users#roles"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["users.read"],
      }}
    >
      <RoutedUserRoleForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
