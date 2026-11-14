import { apiClient } from "@/shared/api";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";

import { RegisterPage } from "./Register";

const meta = {
  component: RegisterPage,
  decorators: [
    (Story) => (
      <div style={{ margin: "32px auto", maxWidth: 520, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <StoryShell initialEntries={["/auth/register"]} withUser={false}>
      <RegisterPage />
    </StoryShell>
  ),
  title: "Features/Auth/Register",
} satisfies Meta<typeof RegisterPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText(i18nInstance.t("firstName")),
    ).toBeVisible();
    await expect(
      canvas.getByLabelText(i18nInstance.t("lastName")),
    ).toBeVisible();
    await expect(
      canvas.getByRole("group", { name: i18nInstance.t("otp") }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: i18nInstance.t("backToLogin") }),
    ).toHaveAttribute("href", "/auth");
  },
};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText(i18nInstance.t("firstName")));
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByLabelText(i18nInstance.t("firstName")),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      canvas.getByLabelText(i18nInstance.t("mobile")),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};

export const ChangedMobileClearsCode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mobile = canvas.getByLabelText(i18nInstance.t("mobile"));
    const requestCode = canvas.getByRole("button", {
      name: i18nInstance.t("sendCode"),
    });
    await userEvent.type(mobile, "09120000000");
    await userEvent.click(requestCode);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/otp-request",
      { mobile: "09120000000", purpose: "register" },
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() => expect(requestCode).toHaveTextContent(/^\d+$/));
    await expect(requestCode).toBeDisabled();
    const digits = within(
      canvas.getByRole("group", { name: i18nInstance.t("otp") }),
    ).getAllByRole("textbox");
    await userEvent.type(digits[0], "123456");
    await expect(digits[0]).toHaveValue("1");
    await userEvent.clear(mobile);
    await userEvent.type(mobile, "09121111111");
    for (const digit of digits) await expect(digit).toHaveValue("");
    await waitFor(() =>
      expect(requestCode).toHaveTextContent(i18nInstance.t("sendCode")),
    );
    await expect(requestCode).toBeEnabled();
    await waitFor(() =>
      expect(
        canvasElement.querySelector("#register-form_mobile_help"),
      ).not.toBeInTheDocument(),
    );
    await expect(apiClient.post).toHaveBeenCalledTimes(1);
  },
};
