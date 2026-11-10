import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AccountPage } from "@/features/account";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";

const meta = {
  title: "Features/Account",
  component: AccountPage,
  render: () => (
    <StoryShell initialEntries={["/account"]}>
      <AccountPage />
    </StoryShell>
  ),
} satisfies Meta<typeof AccountPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(i18n.t("firstName"))).toHaveValue("Ada");
    await expect(canvas.getByLabelText(i18n.t("lastName"))).toHaveValue(
      "Lovelace",
    );
    await expect(
      canvas.getByLabelText(i18n.t("currentPassword")),
    ).toBeVisible();
  },
};
export const SaveProfile: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstName = canvas.getByLabelText(i18n.t("firstName"));
    await userEvent.clear(firstName);
    await userEvent.type(firstName, "Augusta");
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("saveProfile") }),
    );
    await expect(apiClient.patch).toHaveBeenCalledWith(
      "/account/update-profile",
      { firstName: "Augusta", lastName: "Lovelace" },
      { signal: expect.any(AbortSignal) },
    );
    const success = await within(canvasElement.ownerDocument.body).findByText(
      i18n.t("profileUpdated"),
    );
    await waitFor(() => expect(success).toBeVisible());
  },
};
export const RejectMismatchedPassword: Story = {
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
export const PersianDark: Story = {
  globals: { language: "fa", theme: "dark" },
  ...Default,
};
