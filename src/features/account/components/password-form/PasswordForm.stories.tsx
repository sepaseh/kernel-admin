import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { PasswordForm } from "@/features/account/components/password-form";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../../../.storybook/StoryShell";

const meta = {
  title: "Features/Account/PasswordForm",
  component: PasswordForm,
  render: () => (
    <StoryShell initialEntries={["/account"]}>
      <PasswordForm />
    </StoryShell>
  ),
} satisfies Meta<typeof PasswordForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(i18n.t("currentPassword"))).toHaveValue(
      "",
    );
    await expect(canvas.getByLabelText(i18n.t("newPassword"))).toHaveValue("");
    await expect(canvas.getByLabelText(i18n.t("confirmPassword"))).toHaveValue(
      "",
    );
  },
};
export const ChangePassword: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText(i18n.t("currentPassword")),
      "Synthetic-current!",
    );
    await userEvent.type(
      canvas.getByLabelText(i18n.t("newPassword")),
      "Synthetic-new!",
    );
    await userEvent.type(
      canvas.getByLabelText(i18n.t("confirmPassword")),
      "Synthetic-new!",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("changePassword") }),
    );
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/change-password",
      { currentPassword: "Synthetic-current!", newPassword: "Synthetic-new!" },
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() =>
      expect(canvas.getByLabelText(i18n.t("newPassword"))).toHaveValue(""),
    );
  },
};
export const RejectMismatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText(i18n.t("currentPassword")),
      "Synthetic-current!",
    );
    await userEvent.type(
      canvas.getByLabelText(i18n.t("newPassword")),
      "Synthetic-new!",
    );
    await userEvent.type(
      canvas.getByLabelText(i18n.t("confirmPassword")),
      "Different-new!",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("changePassword") }),
    );
    await expect(
      await canvas.findByText(i18n.t("passwordMismatch")),
    ).toBeVisible();
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
