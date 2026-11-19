import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { SettingsPage } from "@/features/settings";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleAccount as sampleUser } from "../../../.storybook/fixtures";

const meta = {
  title: "Features/Settings",
  component: SettingsPage,
  render: () => (
    <StoryShell initialEntries={["/settings"]}>
      <SettingsPage />
    </StoryShell>
  ),
} satisfies Meta<typeof SettingsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("combobox", { name: i18n.t("language") }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("button", { name: i18n.t("submit") }),
    ).toBeEnabled();
    await expect(
      canvas.getAllByRole("spinbutton", { name: i18n.t("imageWidth") })[0],
    ).toHaveValue("1200");
  },
};
export const ResetUnsavedValues: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const width = canvas.getAllByRole("spinbutton", {
      name: i18n.t("imageWidth"),
    })[0];
    await userEvent.clear(width);
    await userEvent.type(width, "900");
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("reset") }),
    );
    await expect(width).toHaveValue("1200");
    await waitFor(() =>
      expect(
        canvasElement.querySelector(".ant-form-item-explain-error"),
      ).toBeNull(),
    );
  },
};
export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      initialUser={{ ...sampleUser, isSystemAdmin: false, permissions: [] }}
    >
      <SettingsPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("combobox", { name: i18n.t("language") }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: i18n.t("submit") }),
    ).toBeDisabled();
  },
};
export const EditorCannotChangeLanguage: Story = {
  render: () => (
    <StoryShell
      initialUser={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["settings.update"],
      }}
    >
      <SettingsPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("combobox", { name: i18n.t("language") }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: i18n.t("submit") }),
    ).toBeEnabled();
  },
};
