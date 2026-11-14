import { isCancel } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiClient,
  clearAccessToken,
  getAccessTokenVersion,
  getSessionSignal,
  setAccessToken,
} from "@/shared/api";

import {
  changePassword,
  forgotPassword,
  login,
  logout,
  register,
  requestOtp,
} from "./api.ts";

vi.mock("@/shared/api", async () => ({
  apiClient: {
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
  clearAccessToken: vi.fn(),
  getAccessTokenVersion: vi.fn(() => 0),
  getSessionSignal: vi.fn(),
  parseAccessToken: (await import("@/shared/api/token")).parseAccessToken,
  setAccessToken: vi.fn(),
}));

const currentCredential = "current-test-credential";
const replacementCredential = "replacement-test-credential";
const syntheticCredential = "synthetic-test-credential";
let session: AbortController;

beforeEach(() => {
  vi.mocked(getAccessTokenVersion).mockReturnValue(0);
  session = new AbortController();
  vi.mocked(getSessionSignal).mockReturnValue(session.signal);
  vi.mocked(apiClient.post).mockResolvedValue({});
});

describe("authentication API", () => {
  it.each(["login", "register"] as const)(
    "does not commit a %s reply when its caller cancels after transport fulfillment",
    async (operation) => {
      const controller = new AbortController();
      let release!: (value: unknown) => void;
      vi.mocked(apiClient.post).mockImplementationOnce(
        () => new Promise((resolve) => (release = resolve)),
      );
      const pending =
        operation === "login"
          ? login(
              { mobile: "09120000000", password: syntheticCredential },
              controller.signal,
            )
          : register(
              {
                firstName: "Ada",
                lastName: "Lovelace",
                mobile: "09120000000",
                otp: "123456",
                password: syntheticCredential,
              },
              controller.signal,
            );
      release({ accessToken: "aborted-reply" });
      controller.abort();

      expect(isCancel(await pending.catch((error: unknown) => error))).toBe(
        true,
      );
      expect(setAccessToken).not.toHaveBeenCalled();
    },
  );

  it.each(["login", "register"] as const)(
    "does not commit a %s reply after its transport completed but the session changed before the feature resumed",
    async (operation) => {
      let release!: (value: unknown) => void;
      vi.mocked(apiClient.post).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const pending =
        operation === "login"
          ? login({ mobile: "09120000000", password: syntheticCredential })
          : register({
              firstName: "Ada",
              lastName: "Lovelace",
              mobile: "09120000000",
              otp: "123456",
              password: syntheticCredential,
            });
      release({ accessToken: "obsolete-reply" });
      // The fulfilled transport has queued the feature continuation. A newer login
      // or logout invalidates it before that continuation is allowed to commit.
      session.abort();
      expect(isCancel(await pending.catch((error: unknown) => error))).toBe(
        true,
      );
      expect(setAccessToken).not.toHaveBeenCalled();
    },
  );

  it("stores access tokens returned by login and registration", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ accessToken: "login-token" })
      .mockResolvedValueOnce({ accessToken: "register-token" });

    await expect(
      login({ mobile: "09120000000", password: syntheticCredential }),
    ).resolves.toEqual({ accessToken: "login-token" });
    await expect(
      register({
        firstName: "Ada",
        lastName: "Lovelace",
        mobile: "09120000000",
        otp: "123456",
        password: syntheticCredential,
      }),
    ).resolves.toEqual({ accessToken: "register-token" });

    expect(setAccessToken).toHaveBeenNthCalledWith(1, "login-token");
    expect(setAccessToken).toHaveBeenNthCalledWith(2, "register-token");
    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/auth/login",
      {
        mobile: "09120000000",
        password: syntheticCredential,
      },
      { signal: undefined },
    );
  });

  it.each(["login", "register"] as const)(
    "does not commit a malformed %s credential",
    async (operation) => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ accessToken: " " });
      const params = {
        mobile: "09120000000",
        password: syntheticCredential,
        firstName: "Ada",
        lastName: "Lovelace",
        otp: "123456",
      };

      await expect(
        operation === "login" ? login(params) : register(params),
      ).rejects.toThrow();
      expect(setAccessToken).not.toHaveBeenCalled();
    },
  );

  it("clears the access token when logout succeeds or fails", async () => {
    await logout();

    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("offline"));
    await expect(logout()).rejects.toThrow("offline");

    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/auth/logout");
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/auth/logout");
    expect(clearAccessToken).toHaveBeenCalledTimes(2);
  });

  it("submits password and OTP operations to their endpoints", async () => {
    const controller = new AbortController();
    await changePassword(
      {
        currentPassword: currentCredential,
        newPassword: replacementCredential,
      },
      controller.signal,
    );
    await forgotPassword({
      mobile: "09120000000",
      otp: "123456",
      password: replacementCredential,
    });
    const otpResponse = { expiresIn: 120, remainingSeconds: 0 };
    vi.mocked(apiClient.post).mockResolvedValueOnce(otpResponse);
    await expect(
      requestOtp({ mobile: "09120000000", purpose: "login" }),
    ).resolves.toEqual(otpResponse);

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/auth/change-password",
      {
        currentPassword: currentCredential,
        newPassword: replacementCredential,
      },
      { signal: controller.signal },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/auth/forgot-password",
      {
        mobile: "09120000000",
        otp: "123456",
        password: replacementCredential,
      },
      { signal: undefined },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      3,
      "/auth/otp-request",
      { mobile: "09120000000", purpose: "login" },
      { signal: undefined },
    );
  });

  it.each([
    { label: "null", response: null },
    { label: "a primitive", response: "invalid" },
    { label: "an array", response: [] },
    { label: "a missing expiry", response: { remainingSeconds: 30 } },
    { label: "a missing cooldown", response: { expiresIn: 120 } },
    {
      label: "a string expiry",
      response: { expiresIn: "120", remainingSeconds: 30 },
    },
    {
      label: "an infinite expiry",
      response: { expiresIn: Infinity, remainingSeconds: 30 },
    },
    {
      label: "a string cooldown",
      response: { expiresIn: 120, remainingSeconds: "30" },
    },
    {
      label: "a non-finite cooldown",
      response: { expiresIn: 120, remainingSeconds: NaN },
    },
    {
      label: "a negative cooldown",
      response: { expiresIn: 120, remainingSeconds: -1 },
    },
  ])("rejects an OTP reply with $label", async ({ response }) => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(response);

    await expect(
      requestOtp({ mobile: "09120000000", purpose: "login" }),
    ).rejects.toThrow();
  });
});
