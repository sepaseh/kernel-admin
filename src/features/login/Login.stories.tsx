import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { login } from "@/features/auth/api";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { LoginPage } from "./Login";

const meta = {
  component: LoginPage,
  decorators: [
    (Story) => (
      <div style={{ margin: "48px auto", maxWidth: 420, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <StoryShell initialEntries={["/auth"]} withUser={false}>
      <LoginPage />
    </StoryShell>
  ),
  title: "Features/Auth/Login",
} satisfies Meta<typeof LoginPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText(i18nInstance.t("identifier")),
    ).toBeVisible();
    await expect(
      canvas.getByLabelText(i18nInstance.t("password")),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: i18nInstance.t("register") }),
    ).toHaveAttribute("href", "/auth/register");
    await expect(
      canvas.getByRole("link", { name: i18nInstance.t("forgotPassword") }),
    ).toHaveAttribute("href", "/auth/forgot-password");
  },
};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("login") }),
    );
    await expect(
      canvas.getByLabelText(i18nInstance.t("identifier")),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      canvas.getByLabelText(i18nInstance.t("password")),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(login).not.toHaveBeenCalled();
  },
};
