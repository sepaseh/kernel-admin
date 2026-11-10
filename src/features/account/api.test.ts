import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/api";

import { fetchCurrentUser, updateProfile } from "./api";

vi.mock("@/shared/api", () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("account HTTP contract", () => {
  it("passes cancellation to the current-user read and returns the server account", async () => {
    const controller = new AbortController();
    const account = {
      id: "synthetic-account",
      firstName: "Ada",
      lastName: "Lovelace",
    };
    vi.mocked(apiClient.get).mockResolvedValue(account);

    await expect(fetchCurrentUser(controller.signal)).resolves.toBe(account);
    expect(apiClient.get).toHaveBeenCalledWith("/account/me", {
      signal: controller.signal,
    });
  });

  it("writes only the supplied profile fields to the current profile endpoint", async () => {
    const controller = new AbortController();
    const profile = { firstName: "Ada", lastName: "Lovelace" };
    vi.mocked(apiClient.patch).mockResolvedValue(profile);

    await expect(updateProfile(profile, controller.signal)).resolves.toBe(
      profile,
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/account/update-profile",
      profile,
      { signal: controller.signal },
    );
  });

  it("keeps write failures available to the account form", async () => {
    const error = new Error("Synthetic profile conflict");
    vi.mocked(apiClient.patch).mockRejectedValue(error);

    await expect(updateProfile({ firstName: "Ada" })).rejects.toBe(error);
  });
});
