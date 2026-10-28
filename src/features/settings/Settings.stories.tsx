import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { resetStoryMocks } from "../../../.storybook/mocks";

import { i18nInstance } from "@/shared/i18n";
import { sampleAccount, sampleLanguages } from "@/test/storybook/fixtures";
import { StoryShell } from "@/test/storybook/StoryShell";

import { updateApplicationSettings } from "./api";
import { SettingsPage } from "./Settings";

const settings = {
  darkTheme: {
    colorBgBase: "#141414",
    colorBgContainer: "#1f1f1f",
    colorBorder: "#424242",
    colorLink: "#1668dc",
    colorPrimary: "#61dafb",
    colorTextBase: "#ffffff",
    colorTextDescription: "#bfbfbf",
  },
  language: {
    calendar: "jalali" as const,
    code: "fa" as const,
    direction: "rtl" as const,
    name: "Persian",
    nativeName: "فارسی",
  },
  lightTheme: {
    colorBgBase: "#ffffff",
    colorBgContainer: "#ffffff",
    colorBorder: "#d9d9d9",
    colorLink: "#1677ff",
    colorPrimary: "#61dafb",
    colorTextBase: "#000000",
    colorTextDescription: "#8c8c8c",
  },
};

const meta = {
  async beforeEach() {
    resetStoryMocks(settings);
  },
  component: SettingsPage,
  globals: { direction: "rtl", language: "fa" },
  render: () => (
    <StoryShell initialEntries={["/settings"]}>
      <SettingsPage />
    </StoryShell>
  ),
  title: "Features/Settings/SettingsPage",
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await canvas.findByRole("combobox", { name: i18nInstance.t("language") }),
    ).toBeEnabled();
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    const confirmation = await body.findByRole("dialog", {
      name: i18nInstance.t("settingsChangeConfirm"),
    });
    await waitFor(() => expect(confirmation).toBeVisible());
    const dialog = within(confirmation);
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("no") }),
    );
    await waitFor(() => expect(confirmation).not.toBeVisible());
    await expect(updateApplicationSettings).not.toHaveBeenCalled();
  },
};

export const AppearanceEditor: Story = {
  render: () => (
    <StoryShell
      initialEntries={["/settings"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["settings.update"],
      }}
    >
      <SettingsPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await canvas.findByRole("button", { name: i18nInstance.t("submit") }),
    ).toBeEnabled();
    await expect(
      canvas.queryByRole("combobox", { name: i18nInstance.t("language") }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    const confirmation = await body.findByRole("dialog", {
      name: i18nInstance.t("settingsChangeConfirm"),
    });
    await userEvent.click(
      within(confirmation).getByRole("button", { name: i18nInstance.t("yes") }),
    );
    await waitFor(() =>
      expect(updateApplicationSettings).toHaveBeenCalledTimes(1),
    );
    const [request] = mocked(updateApplicationSettings).mock.calls[0];
    await expect(request).not.toHaveProperty("languageCode");
    await expect(
      mocked(updateApplicationSettings).mock.results[0].value,
    ).resolves.toMatchObject({
      language: sampleLanguages.fa,
    });
    await waitFor(() => expect(confirmation).not.toBeVisible());
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute(
      "lang",
      "fa",
    );
  },
};

export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      initialEntries={["/settings"]}
      initialUser={{ ...sampleAccount, isSystemAdmin: false, permissions: [] }}
    >
      <SettingsPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: i18nInstance.t("submit") }),
    ).toBeDisabled();
    await expect(
      canvas.queryByRole("combobox", { name: i18nInstance.t("language") }),
    ).not.toBeInTheDocument();
    await expect(updateApplicationSettings).not.toHaveBeenCalled();
  },
};
