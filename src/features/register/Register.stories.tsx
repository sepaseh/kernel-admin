import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { RegisterPage } from "@/features/register";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";

const meta = {
  title: "Features/Auth/Register",
  component: RegisterPage,
  render: () => (
    <StoryShell initialEntries={["/auth/register"]}>
      <div style={{ maxWidth: 440, marginInline: "auto" }}>
        <RegisterPage />
      </div>
    </StoryShell>
  ),
} satisfies Meta<typeof RegisterPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(i18n.t("firstName"))).toBeVisible();
    await expect(canvas.getByLabelText(i18n.t("lastName"))).toBeVisible();
    await expect(
      canvas.getByRole("group", { name: i18n.t("otp") }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: i18n.t("backToLogin") }),
    ).toHaveAttribute("href", "/auth");
  },
};
export const RequestVerificationCode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText(i18n.t("mobile")),
      "09120000000",
    );
    const sendCode = canvas.getByRole("button", { name: i18n.t("sendCode") });
    await userEvent.click(sendCode);
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/otp-request",
      {
        mobile: "09120000000",
        purpose: "register",
      },
      { signal: expect.any(AbortSignal) },
    );
    await expect(sendCode).toBeDisabled();
    await expect(sendCode).toHaveTextContent(/\d/);
  },
};
export const RequiredFields: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("register") }),
    );
    await expect(canvas.getByLabelText(i18n.t("firstName"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
