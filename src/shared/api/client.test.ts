import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { http, HttpResponse } from "msw/http";
import { delay } from "msw/utils/delay";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "../../test/mocks/server.ts";
import { i18nInstance } from "../i18n/index.ts";
import { apiClient, setUnauthorizedHandler } from "./client.ts";
import {
  clearAccessToken,
  getAccessToken,
  getAccessTokenVersion,
  setAccessToken,
} from "./token.ts";

const syntheticCredential = "synthetic-test-credential";

afterEach(() => {
  clearAccessToken();
  setUnauthorizedHandler(null);
});

describe("API client authentication", () => {
  it("cancels an obsolete 500 before normalization when the session changes during the retry decision", async () => {
    for (let pause = 0; pause < 16; pause++) {
      setAccessToken("old-session");
      const version = getAccessTokenVersion();
      let normalizedIn: number | undefined;
      const data = {
        get message() {
          normalizedIn = getAccessTokenVersion();
          return "Synthetic old account failure";
        },
      };
      const adapter = (config: InternalAxiosRequestConfig) =>
        Promise.reject(
          new AxiosError(
            "Server error",
            AxiosError.ERR_BAD_RESPONSE,
            config,
            {},
            {
              config,
              data,
              headers: {},
              status: 500,
              statusText: "Server error",
            },
          ),
        );
      const outcome = apiClient
        .get("/account/me", { adapter })
        .catch((error: unknown) => error);
      for (let index = 0; index < pause; index++) await Promise.resolve();
      clearAccessToken();
      setAccessToken("new-session");
      const value = await outcome;
      if (normalizedIn === undefined) expect(axios.isCancel(value)).toBe(true);
      else expect(normalizedIn).toBe(version);
    }
  });

  it("preserves a public settings error during an immediate account switch", async () => {
    const adapter = (config: InternalAxiosRequestConfig) =>
      Promise.reject(
        new AxiosError(
          "Server error",
          AxiosError.ERR_BAD_RESPONSE,
          config,
          {},
          {
            config,
            data: { message: "Public settings unavailable" },
            headers: {},
            status: 500,
            statusText: "Server error",
          },
        ),
      );
    setAccessToken("old-session");
    const outcome = apiClient.get("/settings", { adapter });
    clearAccessToken();
    setAccessToken("new-session");
    await expect(outcome).rejects.toMatchObject({
      message: "Public settings unavailable",
      status: 500,
    });
  });

  it.each(["get", "del", "patch", "post", "put"] as const)(
    "never transforms an obsolete %s reply after transport interceptors finished but before the client resumed",
    async (method) => {
      for (let pause = 0; pause < 12; pause++) {
        setAccessToken("old-session");
        const version = getAccessTokenVersion();
        let transformedIn: number | undefined;
        const data = {
          get accountId() {
            transformedIn = getAccessTokenVersion();
            return "old-account";
          },
        };
        const adapter = async (config: InternalAxiosRequestConfig) => ({
          config,
          data,
          headers: {},
          status: 200,
          statusText: "OK",
        });
        const pending = (
          ["patch", "post", "put"] as readonly string[]
        ).includes(method)
          ? apiClient[method as "patch" | "post" | "put"](
              "/account/me",
              {},
              { adapter },
            )
          : apiClient[method as "get" | "del"]("/account/me", { adapter });
        const outcome = pending.catch((error: unknown) => error);
        for (let index = 0; index < pause; index++) await Promise.resolve();
        clearAccessToken();
        setAccessToken("new-session");
        const value = await outcome;
        // The getter only observes transformation. It never mutates the session.
        // Either fulfillment occurred under its original generation, or it was canceled.
        if (transformedIn === undefined)
          expect(axios.isCancel(value)).toBe(true);
        else expect(transformedIn).toBe(version);
      }
    },
  );

  it.each(["get", "del", "patch", "post", "put", "blob"] as const)(
    "cancels an old %s intent before dispatch when the account changes immediately",
    async (method) => {
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
        config,
        data: { saved: true },
        headers: {},
        status: 200,
        statusText: "OK",
      }));
      setAccessToken("old-session");
      const config = { adapter };
      const pending = (["patch", "post", "put"] as readonly string[]).includes(
        method,
      )
        ? apiClient[method as "patch" | "post" | "put"](
            "/account/update-profile",
            { firstName: "Old account edit" },
            config,
          )
        : apiClient[method as "get" | "del" | "blob"](
            "/account/update-profile",
            config,
          );
      const outcome = pending.catch((error: unknown) => error);
      clearAccessToken();
      setAccessToken("new-session");
      expect(axios.isCancel(await outcome)).toBe(true);
      expect(adapter).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("new-session");
    },
  );

  it("does not session-bind a public settings read during an immediate account switch", async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      config,
      data: { language: { code: "fa" } },
      headers: {},
      status: 200,
      statusText: "OK",
    }));
    setAccessToken("old-session");
    const pending = apiClient.get("/settings", { adapter });
    clearAccessToken();
    setAccessToken("new-session");
    await expect(pending).resolves.toMatchObject({ language: { code: "fa" } });
    expect(adapter).toHaveBeenCalledOnce();
  });

  it("cancels an old authenticated languages 401 after a newer login without refresh or expiry", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = false;
    const refresh = vi.fn();
    const unauthorized = vi.fn();
    setAccessToken("old-session");
    setUnauthorizedHandler(unauthorized);
    server.use(
      http.get("http://localhost/languages", async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer old-session");
        started = true;
        await gate;
        return HttpResponse.json(
          { message: "Old languages session expired" },
          { status: 401 },
        );
      }),
      http.post("http://localhost/auth/refresh-token", refresh),
    );
    const old = apiClient.get("/languages").catch((error: unknown) => error);
    await vi.waitFor(() => expect(started).toBe(true));
    clearAccessToken();
    setAccessToken("new-session");
    release();
    expect(axios.isCancel(await old)).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    expect(unauthorized).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("new-session");
  });

  it.each(["configless", "versionless", "retried-versionless"])(
    "normalizes a %s 401 without mutating the current login",
    async (identity) => {
      const unauthorized = vi.fn();
      const refresh = vi
        .spyOn(axios, "post")
        .mockResolvedValue({ data: { access_token: "must-not-install" } });
      setAccessToken("current-session");
      setUnauthorizedHandler(unauthorized);
      const adapter = vi.fn((config: InternalAxiosRequestConfig) => {
        const withoutVersion = { ...config };
        Reflect.deleteProperty(withoutVersion, "_authVersion");
        if (identity === "retried-versionless")
          Reflect.set(withoutVersion, "_retried", true);
        return Promise.reject(
          new AxiosError(
            "Missing originating request identity",
            AxiosError.ERR_BAD_REQUEST,
            identity === "configless" ? undefined : withoutVersion,
            {},
            {
              config,
              data: { message: "Unattributed unauthorized response" },
              headers: { "x-request-id": "unattributed-401" },
              status: 401,
              statusText: "Unauthorized",
            },
          ),
        );
      });
      await expect(
        apiClient.get("/unattributed", { adapter }),
      ).rejects.toMatchObject({
        message: "Unattributed unauthorized response",
        status: 401,
        requestId: "unattributed-401",
      });
      expect(adapter).toHaveBeenCalledOnce();
      expect(refresh).not.toHaveBeenCalled();
      expect(unauthorized).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("current-session");
    },
  );

  it("returns a public settings 401 without refreshing or expiring the current login", async () => {
    const unauthorized = vi.fn();
    const refresh = vi.fn();
    let reads = 0;
    setAccessToken("current-session");
    setUnauthorizedHandler(unauthorized);
    server.use(
      http.get("http://localhost/settings", () => {
        reads++;
        return HttpResponse.json(
          { message: "Settings unavailable" },
          { status: 401 },
        );
      }),
      http.post("http://localhost/auth/refresh-token", refresh),
    );
    await expect(apiClient.get("/settings")).rejects.toMatchObject({
      message: "Settings unavailable",
      status: 401,
    });
    expect(reads).toBe(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(unauthorized).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("current-session");
  });

  it.each(["get", "put"] as const)(
    "only exempts public GET settings from session binding (%s)",
    async (method) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let started = false;
      const refresh = vi.fn();
      setAccessToken("old-session");
      server.use(
        http[method]("http://localhost/settings", async () => {
          started = true;
          await gate;
          return HttpResponse.json(
            { language: { code: "en" }, message: "Unauthorized" },
            { status: method === "get" ? 200 : 401 },
          );
        }),
        http.post("http://localhost/auth/refresh-token", refresh),
      );
      const request = (
        method === "get"
          ? apiClient.get("/settings")
          : apiClient.put("/settings", { languageCode: "fa" })
      ).catch((error: unknown) => error);
      await vi.waitFor(() => expect(started).toBe(true));
      clearAccessToken();
      setAccessToken("new-session");
      release();
      const value = await request;
      if (method === "get")
        expect(value).toMatchObject({ language: { code: "en" } });
      else expect(axios.isCancel(value)).toBe(true);
      expect(refresh).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("new-session");
    },
  );

  it.each([401, 403])(
    "ignores an obsolete refresh rejection (%s) after a new login",
    async (status) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let refreshing = false;
      const unauthorized = vi.fn();
      setAccessToken("old-session");
      setUnauthorizedHandler(unauthorized);
      server.use(
        http.get("http://localhost/protected", () =>
          HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
        ),
        http.post("http://localhost/auth/refresh-token", async () => {
          refreshing = true;
          await gate;
          return HttpResponse.json(
            { message: "Old refresh rejected" },
            { status },
          );
        }),
      );
      const old = apiClient.get("/protected").catch((error: unknown) => error);
      await vi.waitFor(() => expect(refreshing).toBe(true));
      clearAccessToken();
      setAccessToken("new-session");
      release();
      expect(axios.isCancel(await old)).toBe(true);
      expect(getAccessToken()).toBe("new-session");
      expect(unauthorized).not.toHaveBeenCalled();
    },
  );

  it.each([200, 401])(
    "does not commit/replay an old un-signaled mutation response (%s) as a new account",
    async (status) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let started = false;
      let patches = 0;
      const refresh = vi.fn();
      const commit = vi.fn();
      setAccessToken("old-session");
      server.use(
        http.patch("http://localhost/account/update-profile", async () => {
          patches += 1;
          started = true;
          await gate;
          return HttpResponse.json(
            { first_name: "Old account", message: "Unauthorized" },
            { status },
          );
        }),
        http.post("http://localhost/auth/refresh-token", refresh),
      );
      const old = apiClient
        .patch("/account/update-profile", { firstName: "Old account" })
        .then(commit)
        .catch((error: unknown) => error);
      await vi.waitFor(() => expect(started).toBe(true));
      clearAccessToken();
      setAccessToken("new-session");
      release();
      expect(axios.isCancel(await old)).toBe(true);
      expect(commit).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      expect(patches).toBe(1);
      expect(getAccessToken()).toBe("new-session");
    },
  );

  it("an old retried 401 cannot clear a newer login", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    const unauthorized = vi.fn();
    setAccessToken("old-session");
    setUnauthorizedHandler(unauthorized);
    server.use(
      http.get("http://localhost/protected", async () => {
        requests += 1;
        if (requests > 1) await gate;
        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }),
      http.post("http://localhost/auth/refresh-token", () =>
        HttpResponse.json({ access_token: "rotated-old-session" }),
      ),
    );
    const old = apiClient.get("/protected").catch((error: unknown) => error);
    await vi.waitFor(() => expect(requests).toBe(2));
    clearAccessToken();
    setAccessToken("new-session");
    release();
    expect(axios.isCancel(await old)).toBe(true);
    expect(unauthorized).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("new-session");
  });

  it("a new session starts its own refresh without waiting for an old generation", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let refreshes = 0;
    setAccessToken("old-session");
    server.use(
      http.get("http://localhost/session-data", ({ request }) =>
        request.headers.get("authorization") === "Bearer new-fresh"
          ? HttpResponse.json({ current: true })
          : HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      ),
      http.post("http://localhost/auth/refresh-token", async () => {
        refreshes += 1;
        if (refreshes === 1) {
          await gate;
          return HttpResponse.json({ message: "Old session" }, { status: 401 });
        }
        return HttpResponse.json({ access_token: "new-fresh" });
      }),
    );
    const old = apiClient.get("/session-data").catch((error: unknown) => error);
    await vi.waitFor(() => expect(refreshes).toBe(1));
    clearAccessToken();
    setAccessToken("new-session");
    await expect(apiClient.get("/session-data")).resolves.toEqual({
      current: true,
    });
    expect(refreshes).toBe(2);
    release();
    expect(axios.isCancel(await old)).toBe(true);
    expect(getAccessToken()).toBe("new-fresh");
  });

  it("bounds shared refresh and keeps a transient timeout retryable without clearing authentication", async () => {
    const onUnauthorized = vi.fn();
    setAccessToken("expired-token");
    setUnauthorizedHandler(onUnauthorized);
    server.use(
      http.get("http://localhost/protected", () =>
        HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      ),
    );
    const refresh = vi
      .spyOn(axios, "post")
      .mockRejectedValueOnce(
        new AxiosError("timeout", AxiosError.ETIMEDOUT, undefined, {}),
      );
    await expect(apiClient.get("/protected")).rejects.toThrow(
      i18nInstance.t("requestTimeout"),
    );
    expect(refresh).toHaveBeenCalledWith(
      "/auth/refresh-token",
      undefined,
      expect.objectContaining({ timeout: 15_000 }),
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("expired-token");
  });

  it("cancels one reader while a shared refresh continues for another", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let refreshes = 0;
    setAccessToken("expired-token");
    server.use(
      http.get("http://localhost/shared/:id", ({ request, params }) =>
        request.headers.get("authorization") === "Bearer fresh-token"
          ? HttpResponse.json({ id: params.id })
          : HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      ),
      http.post("http://localhost/auth/refresh-token", async () => {
        refreshes += 1;
        await gate;
        return HttpResponse.json({ access_token: "fresh-token" });
      }),
    );
    const controller = new AbortController();
    const first = apiClient
      .get("/shared/first", { signal: controller.signal })
      .catch((error: unknown) => error);
    const second = apiClient.get("/shared/second");
    await vi.waitFor(() => expect(refreshes).toBe(1));
    controller.abort();
    expect(axios.isCancel(await first)).toBe(true);
    finish();
    await expect(second).resolves.toEqual({ id: "second" });
    expect(refreshes).toBe(1);
  });

  it("does not restore a cleared session from an obsolete refresh", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let refreshing = false;
    setAccessToken("expired-token");
    server.use(
      http.get("http://localhost/protected", () =>
        HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      ),
      http.post("http://localhost/auth/refresh-token", async () => {
        refreshing = true;
        await gate;
        return HttpResponse.json({ access_token: "obsolete-token" });
      }),
    );
    const request = apiClient
      .get("/protected")
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(refreshing).toBe(true));
    clearAccessToken();
    finish();
    expect(axios.isCancel(await request)).toBe(true);
    expect(getAccessToken()).toBeNull();
  });

  it.each(["request-123", "invalid.request", "x".repeat(129)])(
    "retains only a valid response request ID: %s",
    async (requestId) => {
      server.use(
        http.get("http://localhost/logging-error", () =>
          HttpResponse.json(
            { message: "Request failed" },
            { headers: { "X-Request-Id": requestId }, status: 500 },
          ),
        ),
      );
      const error: unknown = await apiClient
        .get("/logging-error")
        .catch((value: unknown) => value);
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty("message", "Request failed");
      if (requestId === "request-123")
        expect(error).toHaveProperty("requestId", requestId);
      else expect(error).not.toHaveProperty("requestId");
    },
  );

  it("adds the access token to protected requests", async () => {
    setAccessToken("access-token");
    server.use(
      http.get("http://localhost/protected", ({ request }) => {
        expect(request.headers.get("authorization")).toBe(
          "Bearer access-token",
        );

        return HttpResponse.json({ user_id: "user-1" });
      }),
    );

    await expect(
      apiClient.get<{ userId: string }>("/protected"),
    ).resolves.toEqual({ userId: "user-1" });
  });

  it("refreshes an expired token and retries the request once", async () => {
    let protectedRequestCount = 0;
    let refreshRequestCount = 0;

    setAccessToken("expired-token");
    server.use(
      http.get("http://localhost/protected", ({ request }) => {
        protectedRequestCount += 1;

        if (request.headers.get("authorization") === "Bearer fresh-token") {
          return HttpResponse.json({ status: "ready" });
        }

        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }),
      http.post("http://localhost/auth/refresh-token", () => {
        refreshRequestCount += 1;
        return HttpResponse.json({ access_token: "fresh-token" });
      }),
    );

    await expect(
      apiClient.get<{ status: string }>("/protected"),
    ).resolves.toEqual({ status: "ready" });
    expect(getAccessToken()).toBe("fresh-token");
    expect(protectedRequestCount).toBe(2);
    expect(refreshRequestCount).toBe(1);
  });

  it("shares one token refresh across concurrent unauthorized requests", async () => {
    let refreshRequestCount = 0;

    setAccessToken("expired-token");
    server.use(
      http.get("http://localhost/protected/:id", ({ request, params }) => {
        if (request.headers.get("authorization") === "Bearer fresh-token") {
          return HttpResponse.json({ id: params.id });
        }

        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }),
      http.post("http://localhost/auth/refresh-token", async () => {
        refreshRequestCount += 1;
        await delay(10);
        return HttpResponse.json({ access_token: "fresh-token" });
      }),
    );

    await expect(
      Promise.all([
        apiClient.get<{ id: string }>("/protected/one"),
        apiClient.get<{ id: string }>("/protected/two"),
      ]),
    ).resolves.toEqual([{ id: "one" }, { id: "two" }]);
    expect(refreshRequestCount).toBe(1);
  });

  it("clears authentication once when a shared token refresh fails", async () => {
    const onUnauthorized = vi.fn();
    let refreshRequestCount = 0;

    setAccessToken("expired-token");
    setUnauthorizedHandler(onUnauthorized);
    server.use(
      http.get("http://localhost/protected/:id", () =>
        HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      ),
      http.post("http://localhost/auth/refresh-token", async () => {
        refreshRequestCount += 1;
        await delay(10);
        return HttpResponse.json(
          { message: "Refresh rejected" },
          { status: 401 },
        );
      }),
    );

    const results = await Promise.allSettled([
      apiClient.get("/protected/one"),
      apiClient.get("/protected/two"),
    ]);

    expect(results.every(({ status }) => status === "rejected")).toBe(true);
    expect(getAccessToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(refreshRequestCount).toBe(1);
  });

  it("clears authentication when a single token refresh fails", async () => {
    const onUnauthorized = vi.fn();
    let protectedRequestCount = 0;
    let refreshRequestCount = 0;

    setAccessToken("expired-token");
    setUnauthorizedHandler(onUnauthorized);
    server.use(
      http.get("http://localhost/protected", () => {
        protectedRequestCount += 1;
        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }),
      http.post("http://localhost/auth/refresh-token", () => {
        refreshRequestCount += 1;
        return HttpResponse.json(
          { message: "Refresh rejected" },
          { status: 401 },
        );
      }),
    );

    await expect(apiClient.get("/protected")).rejects.toThrow("Unauthorized");
    expect(protectedRequestCount).toBe(1);
    expect(refreshRequestCount).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does not start another refresh when the retried request is unauthorized", async () => {
    const onUnauthorized = vi.fn();
    let protectedRequestCount = 0;
    let refreshRequestCount = 0;

    setAccessToken("expired-token");
    setUnauthorizedHandler(onUnauthorized);
    server.use(
      http.get("http://localhost/protected", () => {
        protectedRequestCount += 1;
        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }),
      http.post("http://localhost/auth/refresh-token", () => {
        refreshRequestCount += 1;
        return HttpResponse.json({ access_token: "fresh-token" });
      }),
    );

    await expect(apiClient.get("/protected")).rejects.toThrow("Unauthorized");
    expect(protectedRequestCount).toBe(2);
    expect(refreshRequestCount).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does not refresh or clear authentication for public auth requests", async () => {
    const onUnauthorized = vi.fn();
    const refresh = vi.fn();

    setUnauthorizedHandler(onUnauthorized);
    server.use(
      http.post("http://localhost/auth/login", () =>
        HttpResponse.json({ message: "Invalid credentials" }, { status: 401 }),
      ),
      http.post("http://localhost/auth/refresh-token", refresh),
    );

    await expect(
      apiClient.post("/auth/login", {
        identifier: "ada",
        password: syntheticCredential,
      }),
    ).rejects.toThrow("Invalid credentials");
    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("API client errors", () => {
  it("transforms structured API errors and preserves their cause", async () => {
    server.use(
      http.get("http://localhost/invalid-request", () =>
        HttpResponse.json(
          {
            cause: { email: "Email is invalid" },
            message: "Validation failed",
          },
          { status: 422 },
        ),
      ),
    );

    await expect(apiClient.get("/invalid-request")).rejects.toMatchObject({
      cause: { email: "Email is invalid" },
      message: "Validation failed",
    });
  });

  it.each([
    ["null", null],
    ["primitive", "failure"],
    ["array", []],
    ["missing message", {}],
    ["empty message", { message: "" }],
    ["non-string message", { message: 500 }],
  ])(
    "uses the unexpected-error message for a %s response body",
    async (label, body) => {
      const path = `/malformed-error/${label.replaceAll(" ", "-")}`;
      server.use(
        http.get(`http://localhost${path}`, () =>
          HttpResponse.json(body, { status: 500 }),
        ),
      );

      await expect(apiClient.get(path)).rejects.toThrow(
        i18nInstance.t("unexpectedError"),
      );
    },
  );

  it("preserves request cancellation", async () => {
    const controller = new AbortController();

    server.use(
      http.get("http://localhost/cancelled", async () => {
        await delay(100);
        return HttpResponse.json({ status: "ready" });
      }),
    );

    const request = apiClient.get("/cancelled", {
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toSatisfy((error: unknown) =>
      axios.isCancel(error),
    );
  });

  it("uses a distinct timeout message and does not retry the mutation", async () => {
    const adapter = vi.fn((config) =>
      Promise.reject(
        new AxiosError("timeout exceeded", AxiosError.ETIMEDOUT, config, {}),
      ),
    );
    await expect(
      apiClient.post("/slow", { value: "example" }, { adapter }),
    ).rejects.toThrow(i18nInstance.t("requestTimeout"));
    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter.mock.calls[0][0].timeout).toBe(15_000);
  });

  it("uses the network-error message for network failures", async () => {
    server.use(
      http.get("http://localhost/network-failure", () => HttpResponse.error()),
    );

    await expect(apiClient.get("/network-failure")).rejects.toThrow(
      i18nInstance.t("networkError"),
    );
  });
});
