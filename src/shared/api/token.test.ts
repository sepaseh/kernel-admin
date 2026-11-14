// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import {
  clearAccessToken,
  getAccessToken,
  getAccessTokenVersion,
  getSessionSignal,
  parseAccessToken,
  setAccessToken,
  setRefreshedAccessToken,
} from "./token";

beforeEach(clearAccessToken);
afterEach(() => {
  clearAccessToken();
  vi.restoreAllMocks();
});

describe("session tokens", () => {
  it("keeps tokens in memory and invalidates the preceding login generation", () => {
    const localWrite = vi.spyOn(Storage.prototype, "setItem");
    const anonymousGeneration = getAccessTokenVersion();
    const anonymousSession = getSessionSignal();
    const anonymousVersion = getAccessTokenVersion();

    setAccessToken("synthetic-first-token");
    const firstGeneration = getAccessTokenVersion();
    const firstSession = getSessionSignal();
    setAccessToken("synthetic-second-token");

    expect(firstGeneration).toBeGreaterThan(anonymousGeneration);
    expect(getAccessTokenVersion()).toBeGreaterThan(firstGeneration);
    expect(anonymousSession.aborted).toBe(true);
    expect(firstSession.aborted).toBe(true);
    expect(getSessionSignal().aborted).toBe(false);
    expect(getAccessToken()).toBe("synthetic-second-token");
    expect(getAccessTokenVersion()).toBe(anonymousVersion + 2);
    expect(localWrite).not.toHaveBeenCalled();
  });

  it("refreshes the credential without invalidating requests in that session", () => {
    setAccessToken("synthetic-original-token");
    const generation = getAccessTokenVersion();
    const session = getSessionSignal();
    const version = getAccessTokenVersion();

    setRefreshedAccessToken("synthetic-refreshed-token");

    expect(getAccessToken()).toBe("synthetic-refreshed-token");
    expect(getAccessTokenVersion()).toBe(generation);
    expect(getSessionSignal()).toBe(session);
    expect(session.aborted).toBe(false);
    expect(getAccessTokenVersion()).toBe(version);
  });

  it("aborts session work and clears the credential on logout", () => {
    setAccessToken("synthetic-token");
    const generation = getAccessTokenVersion();
    const session = getSessionSignal();

    clearAccessToken();

    expect(session.aborted).toBe(true);
    expect(getAccessToken()).toBeNull();
    expect(getAccessTokenVersion()).toBeGreaterThan(generation);
    expect(getSessionSignal()).not.toBe(session);
  });
});

describe("token response validation", () => {
  it("accepts a nonempty token and exposes only the credential", () => {
    expect(
      parseAccessToken({ accessToken: "synthetic-token", ignored: true }),
    ).toEqual({ accessToken: "synthetic-token" });
  });

  it.each([
    undefined,
    null,
    [],
    "token",
    42,
    {},
    { accessToken: 1 },
    { accessToken: "" },
    { accessToken: "  " },
  ])("rejects a malformed token response (%j)", (value) =>
    expect(() => parseAccessToken(value)).toThrow(i18n.t("unexpectedError")),
  );
});
