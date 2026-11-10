import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CalendarPage } from "@/features/calendar";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleUser } from "../../../.storybook/fixtures";

const meta = {
  title: "Features/Calendar",
  component: CalendarPage,
  render: () => (
    <StoryShell initialEntries={["/calendar"]}>
      <CalendarPage />
    </StoryShell>
  ),
} satisfies Meta<typeof CalendarPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NavigateMonths: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("combobox", { name: i18n.t("calendarYear") }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("combobox", { name: i18n.t("calendarMonth") }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("nextMonth") }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("previousMonth") }),
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
    await expect(apiClient.del).not.toHaveBeenCalled();
  },
};
export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["calendar.read"],
      }}
    >
      <CalendarPage />
    </StoryShell>
  ),
  ...NavigateMonths,
};
export const PersianCalendar: Story = {
  globals: { language: "fa", theme: "dark" },
  ...NavigateMonths,
};
