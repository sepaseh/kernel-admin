import axios, { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deferred } from "@/test/deferred";

import { refreshAccessToken } from "./refresh";
import {
  clearAccessToken,
  getAccessToken,
  getSessionSignal,
  setAccessToken,
} from "./token";

beforeEach(clearAccessToken);
afterEach(() => {
  clearAccessToken();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("shared session refresh", () => {
  it("shares concurrent refresh work and accepts the snake-case wire response", async () => {
    const response = deferred<{ data: { access_token: string } }>();
    const post = vi.spyOn(axios, "post").mockReturnValue(response.promise);
    const session = getSessionSignal();
    const first = refreshAccessToken(session);
    const second = refreshAccessToken(session);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      "/auth/refresh-token",
      undefined,
      expect.objectContaining({
        signal: session,
        timeout: 15_000,
        withCredentials: true,
      }),
    );
    response.resolve({ data: { access_token: "synthetic-refreshed-token" } });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { accessToken: "synthetic-refreshed-token" },
      { accessToken: "synthetic-refreshed-token" },
    ]);
    expect(getAccessToken()).toBe("synthetic-refreshed-token");
    expect(getSessionSignal()).toBe(session);
  });

  it("does not let a late refresh overwrite a newer login", async () => {
    const response = deferred<{ data: { access_token: string } }>();
    vi.spyOn(axios, "post").mockReturnValue(response.promise);
    const refresh = refreshAccessToken(getSessionSignal());
    const rejected = expect(refresh).rejects.toSatisfy(axios.isCancel);

    setAccessToken("synthetic-new-login");
    response.resolve({ data: { access_token: "synthetic-old-session" } });

    await rejected;
    expect(getAccessToken()).toBe("synthetic-new-login");
  });

  it("retries a network failure once and then stops", async () => {
    vi.useFakeTimers();
    const post = vi
      .spyOn(axios, "post")
      .mockRejectedValue(new AxiosError("offline", "ERR_NETWORK"));
    const refresh = refreshAccessToken(getSessionSignal());
    const rejected = expect(refresh).rejects.toThrow("offline");

    await vi.advanceTimersByTimeAsync(1_000);
    await rejected;

    expect(post).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBeNull();
  });

  it("does not retry a rejected cookie", async () => {
    const post = vi.spyOn(axios, "post").mockRejectedValue(
      new AxiosError(
        "expired cookie",
        "ERR_BAD_REQUEST",
        undefined,
        undefined,
        {
          status: 401,
          data: {},
          headers: {},
          statusText: "Unauthorized",
          config: { headers: new axios.AxiosHeaders() },
        },
      ),
    );

    await expect(refreshAccessToken(getSessionSignal())).rejects.toThrow(
      "expired cookie",
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("retries one server failure and accepts the next response", async () => {
    vi.useFakeTimers();
    const post = vi
      .spyOn(axios, "post")
      .mockRejectedValueOnce(
        new AxiosError("temporary", "ERR_BAD_RESPONSE", undefined, undefined, {
          status: 503,
          data: {},
          headers: {},
          statusText: "Unavailable",
          config: { headers: new axios.AxiosHeaders() },
        }),
      )
      .mockResolvedValueOnce({
        data: { access_token: "synthetic-recovered-token" },
      });
    const refresh = refreshAccessToken(getSessionSignal());

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(refresh).resolves.toEqual({
      accessToken: "synthetic-recovered-token",
    });
    expect(post).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBe("synthetic-recovered-token");
  });

  it("cancels a pending retry when the session is cleared", async () => {
    vi.useFakeTimers();
    const post = vi
      .spyOn(axios, "post")
      .mockRejectedValue(new AxiosError("offline", "ERR_NETWORK"));
    const refresh = refreshAccessToken(getSessionSignal());
    const rejected = expect(refresh).rejects.toSatisfy(axios.isCancel);
    await vi.advanceTimersByTimeAsync(0);

    clearAccessToken();
    await rejected;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("releases failed work so an explicit later attempt can succeed", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValueOnce({ data: { access_token: "" } })
      .mockResolvedValueOnce({
        data: { access_token: "synthetic-retry-token" },
      });
    const session = getSessionSignal();

    await expect(refreshAccessToken(session)).rejects.toThrow();
    await expect(refreshAccessToken(session)).resolves.toEqual({
      accessToken: "synthetic-retry-token",
    });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
