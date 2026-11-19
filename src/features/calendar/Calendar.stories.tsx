import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";

import { apiClient } from "@/shared/api";
import { sampleAccount } from "../../../.storybook/fixtures";
import { CalendarPage } from "./Calendar";

const meta = {
  component: CalendarPage,
  render: () => (
    <StoryShell initialEntries={["/calendar"]}>
      <CalendarPage />
    </StoryShell>
  ),
  title: "Features/Calendar/Page",
} satisfies Meta<typeof CalendarPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("combobox", { name: i18nInstance.t("calendarYear") }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("combobox", { name: i18nInstance.t("calendarMonth") }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("nextMonth") }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("previousMonth") }),
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
    await expect(apiClient.del).not.toHaveBeenCalled();
  },
};

export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["calendar.read"],
      }}
    >
      <CalendarPage />
    </StoryShell>
  ),
  ...Default,
};

export const PersianCalendar: Story = {
  globals: { language: "fa", theme: "dark" },
  ...Default,
};
