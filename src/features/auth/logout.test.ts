import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiClient,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "../../shared/api/index.ts";
import { logout } from "./api.ts";

const deferred = () => {
  let reject!: (reason: Error) => void;
  let resolve!: () => void;
  const promise = new Promise<void>((yes, no) => {
    reject = no;
    resolve = yes;
  });
  return { promise, reject, resolve };
};

afterEach(() => {
  clearAccessToken();
});

describe("logout session generation", () => {
  it("keeps the void result even when the transport supplies an empty response value", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue("");
    setAccessToken("synthetic-current-session");

    await expect(logout()).resolves.toBeUndefined();
    expect(getAccessToken()).toBeNull();
  });

  it("coalesces overlapping calls in one session and clears that session once", async () => {
    const pending = deferred();
    const post = vi.spyOn(apiClient, "post").mockReturnValue(pending.promise);
    setAccessToken("synthetic-current-session");

    const first = logout();
    const second = logout();

    expect(second).toBe(first);
    expect(post).toHaveBeenCalledExactlyOnceWith("/auth/logout");
    pending.resolve();
    await Promise.all([first, second]);
    expect(getAccessToken()).toBeNull();
  });

  it("clears the initiating session on failure and preserves the rejection", async () => {
    const failure = new Error("Synthetic offline failure");
    vi.spyOn(apiClient, "post").mockRejectedValue(failure);
    setAccessToken("synthetic-current-session");

    await expect(logout()).rejects.toBe(failure);
    expect(getAccessToken()).toBeNull();
  });

  it.each(["success", "failure"])(
    "does not clear a newer login after an old logout %s",
    async (outcome) => {
      const pending = deferred();
      vi.spyOn(apiClient, "post").mockReturnValue(pending.promise);
      setAccessToken("synthetic-old-session");
      const previousLogout = logout();
      const observed = previousLogout.catch((error: unknown) => error);

      clearAccessToken();
      setAccessToken("synthetic-new-session");
      if (outcome === "success") pending.resolve();
      else pending.reject(new Error("Synthetic late rejection"));
      await observed;

      expect(getAccessToken()).toBe("synthetic-new-session");
    },
  );

  it("does not detach a newer session's pending logout when the old one settles", async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    const post = vi
      .spyOn(apiClient, "post")
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    setAccessToken("synthetic-old-session");
    const previousLogout = logout();
    setAccessToken("synthetic-new-session");
    const currentLogout = logout();

    expect(currentLogout).not.toBe(previousLogout);
    oldRequest.resolve();
    await previousLogout;
    expect(getAccessToken()).toBe("synthetic-new-session");
    expect(logout()).toBe(currentLogout);
    expect(post).toHaveBeenCalledTimes(2);

    newRequest.resolve();
    await currentLogout;
    expect(getAccessToken()).toBeNull();
  });
});
