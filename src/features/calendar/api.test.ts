import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/api";

import {
  createCalendarDate,
  deleteCalendarDate,
  fetchCalendarDates,
} from "./api";

vi.mock("@/shared/api", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), del: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("calendar HTTP contract", () => {
  it("reads Gregorian date strings with caller cancellation", async () => {
    const controller = new AbortController();
    const dates = ["2027-03-21", "2027-03-22"];
    vi.mocked(apiClient.get).mockResolvedValue(dates);

    await expect(fetchCalendarDates(controller.signal)).resolves.toBe(dates);
    expect(apiClient.get).toHaveBeenCalledWith("/calendar", {
      signal: controller.signal,
    });
  });

  it("keeps create and delete date representations identical", async () => {
    const controller = new AbortController();
    await createCalendarDate("2027-03-21", controller.signal);
    await deleteCalendarDate("2027-03-21", controller.signal);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/calendar",
      { date: "2027-03-21" },
      { signal: controller.signal },
    );
    expect(apiClient.del).toHaveBeenCalledWith("/calendar/2027-03-21", {
      signal: controller.signal,
    });
  });

  it("propagates a rejected holiday write", async () => {
    const error = new Error("Synthetic calendar unavailable");
    vi.mocked(apiClient.post).mockRejectedValue(error);

    await expect(createCalendarDate("2027-03-21")).rejects.toBe(error);
  });
});
