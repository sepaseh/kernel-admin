// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { CoreContextValue } from "@/app/contexts";
import { render, screen } from "@/test/render";

import {
  createCalendarDate,
  deleteCalendarDate,
  fetchCalendarDates,
} from "./api";
import { CalendarPage } from "./Calendar";

const mocks = vi.hoisted(() => ({
  language: {
    calendar: "gregorian",
    code: "en",
    direction: "ltr",
    name: "English",
    nativeName: "English",
  } as CoreContextValue["language"],
  messageError: vi.fn(),
  messageAPI: {
    error: vi.fn(),
    success: vi.fn(),
  },
  messageSuccess: vi.fn(),
  user: {
    id: "calendar-user",
    isSystemAdmin: true,
    permissions: [] as string[],
  },
}));

mocks.messageAPI.error = mocks.messageError;
mocks.messageAPI.success = mocks.messageSuccess;

vi.mock("@/app/hooks", () => ({
  useAntd: () => ({
    messageAPI: mocks.messageAPI,
    token: { paddingSM: 8 },
  }),
  useCore: () => ({
    language: mocks.language,
    user: mocks.user,
  }),
}));

vi.mock("./api", () => ({
  createCalendarDate: vi.fn(),
  deleteCalendarDate: vi.fn(),
  fetchCalendarDates: vi.fn(),
}));

beforeEach(() => {
  mocks.user = { id: "calendar-user", isSystemAdmin: true, permissions: [] };
  mocks.language = {
    calendar: "gregorian",
    code: "en",
    direction: "ltr",
    name: "English",
    nativeName: "English",
  };
  // Keep the configured date visible and selectable independently of today.
  // Date-only mocking leaves user-event and waitFor on real timers.
  vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
  vi.mocked(fetchCalendarDates).mockResolvedValue(["2026-09-15"]);
  vi.mocked(createCalendarDate).mockResolvedValue(undefined);
  vi.mocked(deleteCalendarDate).mockResolvedValue(undefined);
});

it("uses server calendar and navigation direction independently of its language code", async () => {
  const { rerender } = render(<CalendarPage />);
  await waitFor(() => expect(fetchCalendarDates).toHaveBeenCalledOnce());
  expect(
    screen.getByRole("combobox", { name: "سال تقویم" }).closest(".ant-select"),
  ).toHaveTextContent("2026");
  expect(
    screen.getByRole("button", { name: "ماه بعد" }).querySelector("svg"),
  ).toHaveClass("lucide-chevron-right");

  mocks.language = { ...mocks.language, calendar: "jalali", direction: "rtl" };
  rerender(<CalendarPage />);
  expect(
    screen.getByRole("combobox", { name: "سال تقویم" }).closest(".ant-select"),
  ).toHaveTextContent("1405");
  expect(
    screen.getByRole("button", { name: "ماه بعد" }).querySelector("svg"),
  ).toHaveClass("lucide-chevron-left");
  expect(
    screen.getByRole("combobox", { name: "ماه تقویم" }).closest(".ant-select"),
  ).toHaveTextContent("Shahrivar");
});

afterEach(() => {
  vi.useRealTimers();
});

it("loads calendar dates and removes a selected configured date", async () => {
  const { container, user } = render(<CalendarPage />);

  await waitFor(() => expect(fetchCalendarDates).toHaveBeenCalledOnce());
  const configuredDate = container.querySelector<HTMLElement>(
    '[title="2026-09-15"]',
  );
  expect(configuredDate).not.toBeNull();

  await user.click(configuredDate!);

  await waitFor(() =>
    expect(deleteCalendarDate).toHaveBeenCalledWith(
      "2026-09-15",
      expect.any(AbortSignal),
    ),
  );
  expect(mocks.messageSuccess).toHaveBeenCalledWith(
    "تقویم با موفقیت به‌روزرسانی شد.",
  );
});

it("shows a failed calendar read and lets the user retry", async () => {
  vi.mocked(fetchCalendarDates).mockRejectedValueOnce(
    new Error("Calendar offline"),
  );
  const { user } = render(<CalendarPage />);
  expect(await screen.findByText("Calendar offline")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
  await waitFor(() => expect(fetchCalendarDates).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByText("Calendar offline")).not.toBeInTheDocument(),
  );
});

it.each(["unmount", "permission"])(
  "ignores a late calendar write after %s changes",
  async (change) => {
    let resolve!: () => void;
    vi.mocked(deleteCalendarDate).mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const { container, user, rerender, unmount } = render(<CalendarPage />);
    await waitFor(() => expect(fetchCalendarDates).toHaveBeenCalledOnce());
    const cell = container.querySelector<HTMLElement>('[title="2026-09-15"]');
    await user.click(cell!);
    await waitFor(() => expect(deleteCalendarDate).toHaveBeenCalledOnce());
    if (change === "unmount") unmount();
    else {
      mocks.user = { ...mocks.user, isSystemAdmin: false };
      rerender(<CalendarPage />);
    }
    await act(async () => resolve());
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(fetchCalendarDates).toHaveBeenCalledOnce();
  },
);
