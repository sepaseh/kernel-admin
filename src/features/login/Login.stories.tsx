import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, userEvent, within } from "storybook/test";
import { LoginPage } from "@/features/login";
import { AuthLayout } from "@/layouts/auth";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Features/Auth/Login",
  component: LoginPage,
  parameters: { ownsMain: true },
  render: () => (
    <MemoryRouter initialEntries={["/auth"]}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/auth" element={<LoginPage />} />
        </Route>
        <Route path="/" element={<p>Authenticated destination</p>} />
      </Routes>
    </MemoryRouter>
  ),
} satisfies Meta<typeof LoginPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(i18n.t("mobile"))).toBeVisible();
    await expect(canvas.getByLabelText(i18n.t("password"))).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: i18n.t("register") }),
    ).toHaveAttribute("href", "/auth/register");
    await expect(
      canvas.getByRole("link", { name: i18n.t("forgotPassword") }),
    ).toHaveAttribute("href", "/auth/forgot-password");
  },
};
export const RequiredFields: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("login") }),
    );
    await expect(canvas.getByLabelText(i18n.t("mobile"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(canvas.getByLabelText(i18n.t("password"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
export const SuccessfulLogin: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText(i18n.t("mobile")),
      "09120000000",
    );
    await userEvent.type(
      canvas.getByLabelText(i18n.t("password")),
      "Synthetic-password!",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("login") }),
    );
    await expect(
      await canvas.findByText("Authenticated destination"),
    ).toBeVisible();
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/login",
      {
        mobile: "09120000000",
        password: "Synthetic-password!",
      },
      { signal: expect.any(AbortSignal) },
    );
  },
};
export const PersianDark: Story = {
  globals: { language: "fa", theme: "dark" },
  ...Default,
};
