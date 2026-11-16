// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import {
  createCalendarDate,
  deleteCalendarDate,
  fetchCalendarDates,
} from "./api";
import { CalendarPage } from "./Calendar";

const { messages, language } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  language: { code: "en", calendar: "gregory", direction: "ltr" },
}));
vi.mock("./api", () => ({
  createCalendarDate: vi.fn(),
  deleteCalendarDate: vi.fn(),
  fetchCalendarDates: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, token: { paddingSM: 8 } }),
  useCore: () => ({ settings: { language } }),
}));

const currentUser: CurrentUser = {
  id: "synthetic-calendar-user",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  isSystemAdmin: false,
  status: "active",
  permissions: ["calendar.read", "calendar.update"],
};
const renderPage = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route path="*" element={<CalendarPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  vi.setSystemTime(new Date("2027-09-01T12:00:00Z"));
  currentUser.permissions = ["calendar.read", "calendar.update"];
  vi.mocked(fetchCalendarDates).mockResolvedValue(["2027-09-15"]);
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("calendar interaction", () => {
  it("removes an existing holiday using the Gregorian wire date and refreshes", async () => {
    const { container } = renderPage();
    await waitFor(() =>
      expect(document.querySelector(".ant-spin-fullscreen")).toBeNull(),
    );
    fireEvent.click(
      container.querySelector<HTMLElement>('[title="2027-09-15"]')!,
    );

    await waitFor(() =>
      expect(deleteCalendarDate).toHaveBeenCalledExactlyOnceWith("2027-09-15"),
    );
    expect(createCalendarDate).not.toHaveBeenCalled();
    expect(messages.success).toHaveBeenCalledWith(i18n.t("calendarUpdated"));
    expect(fetchCalendarDates).toHaveBeenCalledTimes(2);
  });

  it("allows viewing dates without update permission and sends no holiday write", async () => {
    currentUser.permissions = ["calendar.read"];
    const { container } = renderPage();
    await waitFor(() =>
      expect(document.querySelector(".ant-spin-fullscreen")).toBeNull(),
    );
    fireEvent.click(
      container.querySelector<HTMLElement>('[title="2027-09-15"]')!,
    );

    expect(deleteCalendarDate).not.toHaveBeenCalled();
    expect(createCalendarDate).not.toHaveBeenCalled();
  });

  it("enables calendar editing after accepting an empty holiday list", async () => {
    const pending = deferred<string[]>();
    vi.mocked(fetchCalendarDates).mockReturnValue(pending.promise);
    const { container } = renderPage();

    expect(container.querySelector(".ant-picker-calendar")).toBeNull();
    expect(document.querySelector(".ant-spin-fullscreen")).not.toBeNull();
    expect(createCalendarDate).not.toHaveBeenCalled();
    expect(deleteCalendarDate).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve([]);
    });

    expect(document.querySelector(".ant-spin-fullscreen")).toBeNull();
    fireEvent.click(
      container.querySelector<HTMLElement>('[title="2027-09-15"]')!,
    );

    await waitFor(() =>
      expect(createCalendarDate).toHaveBeenCalledExactlyOnceWith("2027-09-15"),
    );
    expect(deleteCalendarDate).not.toHaveBeenCalled();
  });

  it("retains accepted holidays when a refresh fails", async () => {
    vi.mocked(fetchCalendarDates)
      .mockResolvedValueOnce(["2027-09-15"])
      .mockRejectedValueOnce(new Error("Synthetic calendar refresh offline"));
    const { container } = renderPage();
    await waitFor(() =>
      expect(document.querySelector(".ant-spin-fullscreen")).toBeNull(),
    );
    fireEvent.click(
      container.querySelector<HTMLElement>('[title="2027-09-16"]')!,
    );

    await waitFor(() => {
      expect(messages.error).toHaveBeenCalledWith(
        "Synthetic calendar refresh offline",
      );
      expect(document.querySelector(".ant-spin-fullscreen")).toBeNull();
    });
    expect(container.querySelector(".ant-picker-calendar")).not.toBeNull();
    fireEvent.click(
      container.querySelector<HTMLElement>('[title="2027-09-15"]')!,
    );

    await waitFor(() =>
      expect(deleteCalendarDate).toHaveBeenCalledExactlyOnceWith("2027-09-15"),
    );
    expect(createCalendarDate).toHaveBeenCalledExactlyOnceWith("2027-09-16");
  });

  it("aborts its read and suppresses late errors after unmount", async () => {
    const pending = deferred<string[]>();
    vi.mocked(fetchCalendarDates).mockReturnValue(pending.promise);
    const { unmount } = renderPage();
    const signal = vi.mocked(fetchCalendarDates).mock.calls[0][0]!;
    unmount();

    await act(async () => {
      pending.reject(new Error("Synthetic obsolete calendar response"));
    });

    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("replaces an initial read failure with the reload error page and prevents writes", async () => {
    vi.mocked(fetchCalendarDates).mockRejectedValueOnce(
      new Error("Synthetic calendar offline"),
    );
    const { container, getByRole, getByText } = renderPage();
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Synthetic calendar offline"),
    );

    await waitFor(() =>
      expect(document.querySelector(".ant-spin-fullscreen")).toBeNull(),
    );
    expect(getByText(i18n.t("unexpectedError"))).toBeDefined();
    expect(getByRole("button", { name: i18n.t("reload") })).toBeDefined();
    expect(container.querySelector(".ant-picker-calendar")).toBeNull();
    expect(createCalendarDate).not.toHaveBeenCalled();
    expect(deleteCalendarDate).not.toHaveBeenCalled();
  });
});
