import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../shared/api/index.ts";
import {
  getAccount,
  requestEmailVerification,
  updateProfile,
  updateUsername,
  verifyEmail,
} from "./api.ts";

vi.mock("../../shared/api/index.ts", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue({});
  vi.mocked(apiClient.patch).mockResolvedValue({});
  vi.mocked(apiClient.post).mockResolvedValue({});
});

describe("account API", () => {
  it("uses the account endpoint", async () => {
    const controller = new AbortController();
    await getAccount(controller.signal);

    expect(apiClient.get).toHaveBeenCalledWith("/account/me", {
      signal: controller.signal,
    });
  });

  it("requests and verifies email changes", async () => {
    const controller = new AbortController();
    await requestEmailVerification(
      { email: "ada@example.com" },
      controller.signal,
    );
    await verifyEmail(
      { email: "ada@example.com", otp: "123456" },
      controller.signal,
    );

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/account/request-email-verification",
      { email: "ada@example.com" },
      { signal: controller.signal },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/account/verify-email",
      {
        email: "ada@example.com",
        otp: "123456",
      },
      { signal: controller.signal },
    );
  });

  it("updates profile and username fields", async () => {
    const controller = new AbortController();
    await updateProfile(
      { firstName: "Ada", lastName: "Lovelace" },
      controller.signal,
    );
    await updateUsername({ username: "ada" }, controller.signal);

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/account/update-profile",
      {
        firstName: "Ada",
        lastName: "Lovelace",
      },
      { signal: controller.signal },
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      "/account/update-username",
      {
        username: "ada",
      },
      { signal: controller.signal },
    );
  });

  it("keeps write calls without an optional signal compatible", async () => {
    await requestEmailVerification({ email: "ada@example.com" });
    await updateProfile({ firstName: "Ada" });
    await updateUsername({ username: "ada" });
    await verifyEmail({ email: "ada@example.com", otp: "123456" });
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/account/update-profile",
      { firstName: "Ada" },
      { signal: undefined },
    );
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/account/verify-email",
      { email: "ada@example.com", otp: "123456" },
      { signal: undefined },
    );
  });
});
