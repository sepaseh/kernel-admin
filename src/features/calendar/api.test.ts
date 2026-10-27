import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../shared/api/index.ts";
import {
  createCalendarDate,
  deleteCalendarDate,
  fetchCalendarDates,
} from "./api.ts";

vi.mock("../../shared/api/index.ts", () => ({
  apiClient: {
    del: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue(["2026-09-15"]);
  vi.mocked(apiClient.post).mockResolvedValue(undefined);
  vi.mocked(apiClient.del).mockResolvedValue(undefined);
});

describe("calendar API", () => {
  it("lists configured calendar dates", async () => {
    const controller = new AbortController();
    await expect(fetchCalendarDates(controller.signal)).resolves.toEqual([
      "2026-09-15",
    ]);
    expect(apiClient.get).toHaveBeenCalledWith("/calendar", {
      signal: controller.signal,
    });
  });

  it("creates and deletes a date", async () => {
    const controller = new AbortController();
    await createCalendarDate("2026-09-15", controller.signal);
    await deleteCalendarDate("2026-09-15", controller.signal);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/calendar",
      {
        date: "2026-09-15",
      },
      { signal: controller.signal },
    );
    expect(apiClient.del).toHaveBeenCalledWith("/calendar/2026-09-15", {
      signal: controller.signal,
    });
  });
});
