import axios, {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  AxiosError,
} from "axios";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import {
  clearAccessToken,
  getAccessToken,
  getSessionSignal,
  setAccessToken,
} from "./token";

const adapter = vi.fn<AxiosAdapter>();
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = adapter;
const { AdminApiError, apiClient, setUnauthorizedHandler } =
  await import("./client");

const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse => ({
  config,
  data,
  headers: {},
  status,
  statusText: String(status),
});
const unauthorized = (config: InternalAxiosRequestConfig, status = 401) =>
  new AxiosError(
    "denied",
    "ERR_BAD_REQUEST",
    config,
    undefined,
    response(config, { message: "Access denied" }, status),
  );

beforeEach(() => {
  clearAccessToken();
  adapter.mockReset();
  setUnauthorizedHandler(null);
});
afterEach(() => {
  clearAccessToken();
  setUnauthorizedHandler(null);
  vi.useRealTimers();
});
afterAll(() => {
  axios.defaults.adapter = originalAdapter;
});
afterAll(() => {
  axios.defaults.adapter = originalAdapter;
});

describe("HTTP boundary", () => {
  it("sends credentials and converts write bodies and response keys", async () => {
    setAccessToken("synthetic-token");
    adapter.mockImplementation(async (config) => {
      expect(config.withCredentials).toBe(true);
      expect(config.headers.getAuthorization()).toBe("Bearer synthetic-token");
      expect(JSON.parse(config.data)).toEqual({
        first_name: "Test",
        nested_rows: [{ is_active: true }],
      });
      return response(config, {
        first_name: "Test",
        nested_rows: [{ is_active: true }],
        optional: null,
      });
    });

    await expect(
      apiClient.patch("/users/example", {
        firstName: "Test",
        nestedRows: [{ isActive: true }],
      }),
    ).resolves.toEqual({ firstName: "Test", nestedRows: [{ isActive: true }] });
  });

  it("shares one refresh across simultaneous 401s and replays with the new token", async () => {
    setAccessToken("synthetic-expired-token");
    const refreshStarted = deferred<void>();
    const refreshResponse = deferred<{ access_token: string }>();
    let refreshCalls = 0;
    adapter.mockImplementation(async (config) => {
      if (config.url === "/auth/refresh-token") {
        refreshCalls += 1;
        refreshStarted.resolve();
        return response(config, await refreshResponse.promise);
      }
      if (
        config.headers.get("Authorization") === "Bearer synthetic-expired-token"
      )
        throw unauthorized(config);
      return response(config, { authenticated: true });
    });
    const first = apiClient.get("/users");
    const second = apiClient.get("/roles");
    await refreshStarted.promise;
    refreshResponse.resolve({ access_token: "synthetic-current-token" });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { authenticated: true },
      { authenticated: true },
    ]);
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe("synthetic-current-token");
  });

  it("stops replay after one refresh and expires the rejected session once", async () => {
    const expired = vi.fn();
    setUnauthorizedHandler(expired);
    setAccessToken("synthetic-expired-token");
    adapter.mockImplementation(async (config) => {
      if (config.url === "/auth/refresh-token")
        return response(config, { access_token: "synthetic-rejected-token" });
      throw unauthorized(config);
    });

    await expect(apiClient.get("/users")).rejects.toMatchObject({
      name: "AdminApiError",
      status: 401,
    });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(
      adapter.mock.calls.filter(([config]) => config.url === "/users"),
    ).toHaveLength(2);
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.url === "/auth/refresh-token",
      ),
    ).toHaveLength(1);
  });

  it.each(["503", "network", "timeout"] as const)(
    "preserves the session after exhausted %s refresh failures and allows a later retry",
    async (failure) => {
      vi.useFakeTimers();
      const expired = vi.fn();
      setUnauthorizedHandler(expired);
      setAccessToken("synthetic-expired-token");
      const session = getSessionSignal();
      let refreshCalls = 0;
      adapter.mockImplementation(async (config) => {
        if (config.url === "/auth/refresh-token") {
          refreshCalls += 1;
          expect(config.timeout).toBe(15_000);
          if (refreshCalls > 2)
            return response(config, {
              access_token: "synthetic-current-token",
            });
          if (failure === "503")
            throw new AxiosError(
              "unavailable",
              AxiosError.ERR_BAD_RESPONSE,
              config,
              undefined,
              response(
                config,
                { message: "Synthetic service unavailable" },
                503,
              ),
            );
          throw new AxiosError(
            "unavailable",
            failure === "network"
              ? AxiosError.ERR_NETWORK
              : AxiosError.ETIMEDOUT,
            config,
            {},
          );
        }
        if (
          config.headers.get("Authorization") ===
          "Bearer synthetic-expired-token"
        )
          throw unauthorized(config);
        return response(config, { first_name: "Test" });
      });
      const rejected = expect(
        apiClient.patch("/users/synthetic-user", { firstName: "Test" }),
      ).rejects.toMatchObject({
        name: "AdminApiError",
        message:
          failure === "503"
            ? "Synthetic service unavailable"
            : i18n.t(failure === "network" ? "networkError" : "requestTimeout"),
      });

      await vi.advanceTimersByTimeAsync(1_000);
      await rejected;

      expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
        "/users/synthetic-user",
        "/auth/refresh-token",
        "/auth/refresh-token",
      ]);
      expect(expired).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("synthetic-expired-token");
      expect(getSessionSignal()).toBe(session);
      expect(session.aborted).toBe(false);

      await expect(
        apiClient.patch("/users/synthetic-user", { firstName: "Test" }),
      ).resolves.toEqual({ firstName: "Test" });
      expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
        "/users/synthetic-user",
        "/auth/refresh-token",
        "/auth/refresh-token",
        "/users/synthetic-user",
        "/auth/refresh-token",
        "/users/synthetic-user",
      ]);
      expect(getAccessToken()).toBe("synthetic-current-token");
      expect(getSessionSignal()).toBe(session);
      expect(expired).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403])(
    "clears the session after refresh %s without replaying the write",
    async (status) => {
      const expired = vi.fn();
      setUnauthorizedHandler(expired);
      setAccessToken("synthetic-expired-token");
      adapter.mockImplementation(async (config) => {
        throw unauthorized(
          config,
          config.url === "/auth/refresh-token" ? status : 401,
        );
      });

      await expect(
        apiClient.patch("/users/synthetic-user", { firstName: "Test" }),
      ).rejects.toMatchObject({ status, message: "Access denied" });

      expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
        "/users/synthetic-user",
        "/auth/refresh-token",
      ]);
      expect(expired).toHaveBeenCalledTimes(1);
      expect(getAccessToken()).toBeNull();
    },
  );

  it("expires an invalid refresh token without replaying the write", async () => {
    const expired = vi.fn();
    setUnauthorizedHandler(expired);
    setAccessToken("synthetic-expired-token");
    adapter.mockImplementation(async (config) => {
      if (config.url === "/auth/refresh-token")
        return response(config, { access_token: "" });
      throw unauthorized(config);
    });

    await expect(
      apiClient.patch("/users/synthetic-user", { firstName: "Test" }),
    ).rejects.toBeInstanceOf(AdminApiError);

    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      "/users/synthetic-user",
      "/auth/refresh-token",
    ]);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("cancels one refresh waiter without canceling another request", async () => {
    setAccessToken("synthetic-expired-token");
    const refreshStarted = deferred<void>();
    const refreshResponse = deferred<{ access_token: string }>();
    adapter.mockImplementation(async (config) => {
      if (config.url === "/auth/refresh-token") {
        refreshStarted.resolve();
        return response(config, await refreshResponse.promise);
      }
      if (
        config.headers.get("Authorization") === "Bearer synthetic-expired-token"
      )
        throw unauthorized(config);
      return response(config, { ok: true });
    });
    const controller = new AbortController();
    const canceled = apiClient.get("/users", { signal: controller.signal });
    const rejected = expect(canceled).rejects.toSatisfy(axios.isCancel);
    const continuing = apiClient.get("/roles");
    await refreshStarted.promise;
    controller.abort();
    await rejected;
    refreshResponse.resolve({ access_token: "synthetic-refreshed-token" });

    await expect(continuing).resolves.toEqual({ ok: true });
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.url === "/auth/refresh-token",
      ),
    ).toHaveLength(1);
  });

  it("rejects a late response from an older session", async () => {
    setAccessToken("synthetic-old-token");
    const started = deferred<void>();
    const pending = deferred<unknown>();
    adapter.mockImplementation(async (config) => {
      started.resolve();
      return response(config, await pending.promise);
    });
    const request = apiClient.get("/account/me");
    const rejected = expect(request).rejects.toSatisfy(axios.isCancel);
    await started.promise;
    setAccessToken("synthetic-new-token");
    pending.resolve({ id: "old-account" });

    await rejected;
    expect(getAccessToken()).toBe("synthetic-new-token");
  });

  it("keeps public settings readable across a session change", async () => {
    const started = deferred<void>();
    const pending = deferred<unknown>();
    adapter.mockImplementation(async (config) => {
      started.resolve();
      return response(config, await pending.promise);
    });
    const request = apiClient.get("/settings");
    await started.promise;
    clearAccessToken();
    pending.resolve({ language: { code: "fa" } });

    await expect(request).resolves.toEqual({ language: { code: "fa" } });
  });

  it.each(["/auth/login", "/auth/register", "/auth/otp-request"])(
    "does not refresh a failed public authentication request (%s)",
    async (url) => {
      const expired = vi.fn();
      setUnauthorizedHandler(expired);
      adapter.mockImplementation(async (config) => {
        throw unauthorized(config);
      });

      await expect(apiClient.post(url, {})).rejects.toBeInstanceOf(
        AdminApiError,
      );
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(expired).not.toHaveBeenCalled();
    },
  );

  it("expires a forbidden current account without treating other 403s as logout", async () => {
    const expired = vi.fn();
    setAccessToken("synthetic-token");
    setUnauthorizedHandler(expired);
    adapter.mockImplementation(async (config) => {
      throw unauthorized(config, 403);
    });

    await expect(apiClient.get("/users")).rejects.toMatchObject({
      status: 403,
    });
    expect(expired).not.toHaveBeenCalled();
    await expect(apiClient.get("/account/me")).rejects.toMatchObject({
      status: 403,
    });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("preserves a safe request ID and API message for an error report", async () => {
    adapter.mockImplementation(async (config) => {
      const result = response(config, { message: "Synthetic conflict" }, 409);
      result.headers["x-request-id"] = "synthetic-request_123";
      throw new AxiosError(
        "conflict",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        result,
      );
    });

    await expect(apiClient.put("/settings", {})).rejects.toMatchObject({
      message: "Synthetic conflict",
      status: 409,
      requestId: "synthetic-request_123",
    });
  });
});
