import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useCallback } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { apiClient } from "@/shared/api";
import { useGoBack } from "@/shared/hooks";
import { i18nInstance } from "@/shared/i18n";

import { sampleAccount, user } from "../../../../../.storybook/fixtures";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import { UserForm } from "./UserForm";

type RoutedUserFormProps = ComponentProps<typeof UserForm>;

const RoutedUserForm = ({
  onClose,
  onFinish,
  ...args
}: RoutedUserFormProps) => {
  const goBack = useGoBack();
  const handleClose = useCallback(() => {
    onClose();
    goBack();
  }, [goBack, onClose]);
  const handleFinish = () => {
    onFinish();
    goBack();
  };

  return <UserForm {...args} onClose={handleClose} onFinish={handleFinish} />;
};

const meta = {
  args: { onClose: fn() },
  component: UserForm,
  title: "Features/Users/UserForm",
} satisfies Meta<typeof UserForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  args: { onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/#create"]}>
      <RoutedUserForm {...args} />
    </StoryShell>
  ),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    const firstName = dialog.getByLabelText(i18nInstance.t("firstName"));
    await waitFor(() => expect(firstName).toHaveFocus());
    await userEvent.type(firstName, "Mina");
    await userEvent.type(
      dialog.getByLabelText(i18nInstance.t("lastName")),
      "Rahimi",
    );
    await userEvent.type(
      dialog.getByLabelText(i18nInstance.t("mobile")),
      "09123334444",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/users",
        {
          firstName: "Mina",
          lastName: "Rahimi",
          mobile: "09123334444",
          password: expect.stringMatching(/^[a-z0-9]{16}$/),
          status: "active",
        },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledTimes(1));
  },
};

export const Update: Story = {
  args: { id: user.id, onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/#update"]}>
      <RoutedUserForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await waitFor(() =>
      expect(dialog.getByLabelText(i18nInstance.t("firstName"))).toHaveValue(
        "Sara",
      ),
    );
    await expect(dialog.getByLabelText(i18nInstance.t("lastName"))).toHaveValue(
      "Ahmadi",
    );
    await expect(dialog.getByLabelText(i18nInstance.t("mobile"))).toHaveValue(
      "09121111111",
    );
  },
};

export const ValidationErrors: Story = {
  args: { onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/#create"]}>
      <RoutedUserForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      body.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await expect(
      body.getByLabelText(i18nInstance.t("firstName")),
    ).toHaveAttribute("aria-invalid", "true");
  },
};

export const DeniedCreate: Story = {
  args: { onFinish: fn() },
  render: (args) => (
    <StoryShell
      initialEntries={["/users#create"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["users.read"],
      }}
    >
      <RoutedUserForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
