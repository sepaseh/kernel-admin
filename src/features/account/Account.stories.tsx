import { apiClient } from "@/shared/api";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";
import { sampleLanguages } from "../../../.storybook/fixtures";
import { StoryShell } from "../../../.storybook/StoryShell";

import { AccountPage } from "./Account";

const meta = {
  component: AccountPage,
  render: () => (
    <StoryShell initialEntries={["/account"]}>
      <AccountPage />
    </StoryShell>
  ),
  title: "Features/Account/Page",
} satisfies Meta<typeof AccountPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const firstName = canvas.getByLabelText(i18nInstance.t("firstName"));
    await userEvent.clear(firstName);
    await userEvent.type(firstName, "Samira");
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/account/update-profile",
        { firstName: "Samira", lastName: "Admin" },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await waitFor(() =>
      expect(body.getByText(i18nInstance.t("profileUpdated"))).toBeVisible(),
    );
  },
};

export const DarkRtl: Story = {
  globals: { direction: "rtl", language: "fa", theme: "dark" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText(i18nInstance.t("firstName")),
    ).toHaveValue("Sample");
    await expect(
      canvas.getByLabelText(i18nInstance.t("currentPassword")),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    ).toBeVisible();
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute(
      "dir",
      "rtl",
    );
  },
  render: () => (
    <StoryShell
      initialEntries={["/account"]}
      initialLanguage={sampleLanguages.fa}
      initialTheme="dark"
    >
      <AccountPage />
    </StoryShell>
  ),
};

export const RejectMismatchedPassword: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText(i18nInstance.t("currentPassword")),
      "Synthetic-current!",
    );
    await userEvent.type(
      canvas.getByLabelText(i18nInstance.t("newPassword")),
      "Synthetic-new!",
    );
    await userEvent.type(
      canvas.getByLabelText(i18nInstance.t("confirmPassword")),
      "Different-new!",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("changePassword") }),
    );
    await waitFor(() =>
      expect(
        canvas.getByText(i18nInstance.t("passwordMismatch")),
      ).toBeVisible(),
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
