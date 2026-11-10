import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, waitFor, within } from "storybook/test";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/layouts/auth";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/shared/api";
import { i18n } from "@/shared/i18n";

const AuthContent = () => {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t("login")}</h1>
      <p>Authentication content renders inside the layout.</p>
    </section>
  );
};

const meta = {
  title: "Layouts/Auth",
  component: AuthLayout,
  parameters: { ownsMain: true },
  beforeEach: () => {
    setAccessToken("synthetic-auth-layout-session");
    return clearAccessToken;
  },
  render: () => (
    <MemoryRouter initialEntries={["/auth"]}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/auth" element={<AuthContent />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
} satisfies Meta<typeof AuthLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("heading", { name: i18n.t("login") }),
    ).toBeVisible();
    await expect(within(canvasElement).getByRole("main")).toContainElement(
      within(canvasElement).getByRole("heading"),
    );
    await waitFor(() => expect(getAccessToken()).toBeNull());
  },
};
export const PersianDark: Story = {
  ...Default,
  globals: { language: "fa", theme: "dark" },
};
