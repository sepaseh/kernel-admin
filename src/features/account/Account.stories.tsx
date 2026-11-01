import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { sampleAccount, sampleLanguages } from "@/test/storybook/fixtures";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { AccountPage } from "./Account";
import { updateProfile } from "./api";

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
  beforeEach() {
    mocked(updateProfile).mockResolvedValue({
      ...sampleAccount,
      firstName: "Samira",
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstName = canvas.getByLabelText(i18nInstance.t("firstName"));
    await expect(
      canvas.getByLabelText(i18nInstance.t("mobile")),
    ).toBeDisabled();
    await userEvent.clear(firstName);
    await userEvent.type(firstName, "Samira");
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        { firstName: "Samira", lastName: "Admin" },
        expect.any(AbortSignal),
      ),
    );
    await expect(firstName).toHaveValue("Samira");
  },
};

export const WithoutAuthenticatedUser: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByLabelText(i18nInstance.t("firstName")),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: i18nInstance.t("saveProfile") }),
    ).not.toBeInTheDocument();
  },
  render: () => (
    <StoryShell initialEntries={["/account"]} withUser={false}>
      <AccountPage />
    </StoryShell>
  ),
};

export const DarkRtl: Story = {
  globals: { direction: "rtl", language: "fa", theme: "dark" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText(i18nInstance.t("firstName")),
    ).toHaveValue("Sample");
    await expect(
      canvas.getByRole("group", { name: i18nInstance.t("otp") }),
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
