import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/api";

import { fetchCurrentUser, updateProfile } from "./api";

vi.mock("@/shared/api", () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue({ id: "synthetic-user" });
  vi.mocked(apiClient.patch).mockResolvedValue({ id: "synthetic-user" });
});

describe("account API", () => {
  it("reads the current user and forwards cancellation", async () => {
    const controller = new AbortController();
    await expect(fetchCurrentUser(controller.signal)).resolves.toEqual({
      id: "synthetic-user",
    });
    expect(apiClient.get).toHaveBeenCalledWith("/account/me", {
      signal: controller.signal,
    });
  });

  it("updates the profile fields and forwards cancellation", async () => {
    const controller = new AbortController();
    await updateProfile(
      { firstName: "Ada", lastName: "Lovelace" },
      controller.signal,
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/account/update-profile",
      { firstName: "Ada", lastName: "Lovelace" },
      { signal: controller.signal },
    );
  });

  it("keeps current-user reads and partial profile writes compatible without a signal", async () => {
    await fetchCurrentUser();
    await updateProfile({ firstName: "Ada" });
    expect(apiClient.get).toHaveBeenCalledWith("/account/me", {
      signal: undefined,
    });
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/account/update-profile",
      { firstName: "Ada" },
      { signal: undefined },
    );
  });
});
