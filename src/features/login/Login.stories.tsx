import { apiClient } from "@/shared/api";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Route, Routes } from "react-router";
import { expect, userEvent, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";

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
      <Routes>
        <Route element={<LoginPage />} path="/auth" />
        <Route element={<p>Authenticated destination</p>} path="/" />
      </Routes>
    </StoryShell>
  ),
  title: "Features/Auth/Login",
} satisfies Meta<typeof LoginPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(i18nInstance.t("mobile"))).toBeVisible();
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
      canvas.getByLabelText(i18nInstance.t("mobile")),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      canvas.getByLabelText(i18nInstance.t("password")),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};

export const SuccessfulLogin: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText(i18nInstance.t("mobile")),
      "09120000000",
    );
    await userEvent.type(
      canvas.getByLabelText(i18nInstance.t("password")),
      "Synthetic-password!",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("login") }),
    );

    await expect(
      await canvas.findByText("Authenticated destination"),
    ).toBeVisible();
    await expect(apiClient.post).toHaveBeenCalledTimes(1);
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/login",
      { mobile: "09120000000", password: "Synthetic-password!" },
      { signal: expect.any(AbortSignal) },
    );
  },
};

export const PersianDark: Story = {
  ...Default,
  globals: { language: "fa", theme: "dark" },
};
