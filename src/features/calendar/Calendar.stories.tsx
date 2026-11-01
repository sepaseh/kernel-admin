import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import {
  createCalendarDate,
  deleteCalendarDate,
  fetchCalendarDates,
} from "./api";
import { CalendarPage } from "./Calendar";

const meta = {
  async beforeEach() {
    mocked(fetchCalendarDates).mockResolvedValue(["2026-09-15", "2026-09-23"]);
  },
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
    await expect(createCalendarDate).not.toHaveBeenCalled();
    await expect(deleteCalendarDate).not.toHaveBeenCalled();
  },
};
