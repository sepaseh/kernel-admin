import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useCallback } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { apiClient } from "@/shared/api";
import { useGoBack } from "@/shared/hooks";
import { i18nInstance } from "@/shared/i18n";

import {
  permissions,
  roles,
  sampleAccount,
} from "../../../../../.storybook/fixtures";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import { RoleForm } from "./RoleForm";

type RoutedRoleFormProps = ComponentProps<typeof RoleForm>;

const RoutedRoleForm = ({
  onClose,
  onFinish,
  ...args
}: RoutedRoleFormProps) => {
  const goBack = useGoBack();
  const handleClose = useCallback(() => {
    onClose();
    goBack();
  }, [goBack, onClose]);
  const handleFinish = () => {
    onFinish();
    goBack();
  };

  return <RoleForm {...args} onClose={handleClose} onFinish={handleFinish} />;
};

const meta = {
  args: { onClose: fn() },
  component: RoleForm,
  title: "Features/Roles/RoleForm",
} satisfies Meta<typeof RoleForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  args: { onFinish: fn(), options: { permissions } },
  render: (args) => (
    <StoryShell initialEntries={["/#create"]}>
      <RoutedRoleForm {...args} />
    </StoryShell>
  ),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.type(
      dialog.getByLabelText(i18nInstance.t("name")),
      "Reviewers",
    );
    await userEvent.click(dialog.getByRole("checkbox", { name: "View users" }));
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/roles",
        { name: "Reviewers", permissions: ["users.read"] },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledTimes(1));
  },
};

export const Update: Story = {
  args: {
    id: roles[0].id,
    onFinish: fn(),
    options: { permissions },
  },
  render: (args) => (
    <StoryShell initialEntries={["/#update"]}>
      <RoutedRoleForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    const name = await dialog.findByLabelText(i18nInstance.t("name"));
    await waitFor(() => expect(name).toHaveValue("Administrator"));
    await expect(
      dialog.getByRole("checkbox", { name: "View users" }),
    ).toBeChecked();
    await expect(
      dialog.getByRole("checkbox", { name: "Manage users" }),
    ).not.toBeChecked();
  },
};

export const ValidationErrors: Story = {
  args: { onFinish: fn(), options: { permissions } },
  render: (args) => (
    <StoryShell initialEntries={["/#create"]}>
      <RoutedRoleForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      body.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await expect(body.getByLabelText(i18nInstance.t("name"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};

export const DeniedCreate: Story = {
  args: { onFinish: fn(), options: { permissions } },
  render: (args) => (
    <StoryShell
      initialEntries={["/roles#create"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["roles.read"],
      }}
    >
      <RoutedRoleForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
