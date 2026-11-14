import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/shared/api";
import { deferred } from "@/test/deferred";

import {
  changePassword,
  forgotPassword,
  login,
  logout,
  register,
  requestOtp,
} from "./api";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    apiClient: {
      del: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
      post,
      put: vi.fn(),
      upload: vi.fn(),
    },
  };
});

beforeEach(() => {
  clearAccessToken();
  post.mockReset();
});
afterEach(clearAccessToken);

describe("authentication responses", () => {
  it("accepts a validated login credential", async () => {
    post.mockResolvedValue({ accessToken: "synthetic-login-token" });

    await expect(
      login({ mobile: "09120000000", password: "synthetic-password" }),
    ).resolves.toEqual({ accessToken: "synthetic-login-token" });
    expect(getAccessToken()).toBe("synthetic-login-token");
  });

  it("does not replace the session after a malformed login response", async () => {
    setAccessToken("synthetic-existing-token");
    post.mockResolvedValue({ accessToken: " " });

    await expect(
      login({ mobile: "09120000000", password: "synthetic-password" }),
    ).rejects.toThrow();
    expect(getAccessToken()).toBe("synthetic-existing-token");
  });

  it("forwards caller cancellation to logout and password changes", async () => {
    const controller = new AbortController();
    const { signal } = controller;
    const params = {
      currentPassword: "synthetic-old",
      newPassword: "synthetic-new",
    };

    await logout(signal);
    expect(post).toHaveBeenLastCalledWith("/auth/logout", undefined, {
      signal,
    });

    await changePassword(params, signal);
    expect(post).toHaveBeenLastCalledWith("/auth/change-password", params, {
      signal,
    });
  });

  it("forwards the caller signal to each public authentication request", async () => {
    const controller = new AbortController();
    const { signal } = controller;
    const loginParams = {
      mobile: "09120000000",
      password: "synthetic-password",
    };
    const recoveryParams = { ...loginParams, otp: "123456" };
    const registerParams = {
      ...recoveryParams,
      firstName: "Test",
      lastName: "User",
    };
    const otpParams = {
      mobile: loginParams.mobile,
      purpose: "register" as const,
    };

    post.mockResolvedValueOnce({ accessToken: "synthetic-login-token" });
    await login(loginParams, signal);
    expect(post).toHaveBeenLastCalledWith("/auth/login", loginParams, {
      signal,
    });

    post.mockResolvedValueOnce({ accessToken: "synthetic-register-token" });
    await register(registerParams, signal);
    expect(post).toHaveBeenLastCalledWith("/auth/register", registerParams, {
      signal,
    });

    post.mockResolvedValueOnce(undefined);
    await forgotPassword(recoveryParams, signal);
    expect(post).toHaveBeenLastCalledWith(
      "/auth/forgot-password",
      recoveryParams,
      { signal },
    );

    post.mockResolvedValueOnce({ expiresIn: 300, remainingSeconds: 60 });
    await requestOtp(otpParams, signal);
    expect(post).toHaveBeenLastCalledWith("/auth/otp-request", otpParams, {
      signal,
    });
  });

  it.each(["login", "register"] as const)(
    "rejects a late %s credential when its caller aborted",
    async (action) => {
      setAccessToken("synthetic-existing-token");
      const controller = new AbortController();
      const pending = deferred<unknown>();
      post.mockReturnValue(pending.promise);
      const params = {
        mobile: "09120000000",
        password: "synthetic-password",
        firstName: "Test",
        lastName: "User",
        otp: "123456",
      };
      const request =
        action === "login"
          ? login(params, controller.signal)
          : register(params, controller.signal);
      const rejected = expect(request).rejects.toSatisfy(axios.isCancel);

      controller.abort();
      pending.resolve({ accessToken: "synthetic-abandoned-token" });

      await rejected;
      expect(getAccessToken()).toBe("synthetic-existing-token");
    },
  );

  it.each(["login", "register"] as const)(
    "rejects a late %s response from an abandoned session",
    async (action) => {
      const pending = deferred<unknown>();
      post.mockReturnValue(pending.promise);
      const params = {
        mobile: "09120000000",
        password: "synthetic-password",
        firstName: "Test",
        lastName: "User",
        otp: "123456",
      };
      const request = action === "login" ? login(params) : register(params);
      const rejected = expect(request).rejects.toSatisfy(axios.isCancel);
      setAccessToken("synthetic-new-session");
      pending.resolve({ accessToken: "synthetic-stale-token" });

      await rejected;
      expect(getAccessToken()).toBe("synthetic-new-session");
    },
  );
});
