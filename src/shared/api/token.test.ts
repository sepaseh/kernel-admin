import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAccessToken,
  getAccessToken,
  getAccessTokenVersion,
  setAccessToken,
  setRefreshedAccessToken,
} from "./token";

beforeEach(() => {
  clearAccessToken();
});

describe("access token", () => {
  it("is absent before a token is set", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("stores and retrieves a token", () => {
    setAccessToken("access-token");

    expect(getAccessToken()).toBe("access-token");
  });

  it("clears a stored token", () => {
    setAccessToken("access-token");

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
  });

  it("rotates refreshed credentials within the current login generation", () => {
    const beforeLogin = getAccessTokenVersion();
    setAccessToken("initial-login-token");
    const loginGeneration = getAccessTokenVersion();

    setRefreshedAccessToken("rotated-token");

    expect(loginGeneration).toBeGreaterThan(beforeLogin);
    expect(getAccessToken()).toBe("rotated-token");
    expect(getAccessTokenVersion()).toBe(loginGeneration);
  });

  it("invalidates the previous generation across logout and a subsequent login", () => {
    setAccessToken("first-login-token");
    const firstGeneration = getAccessTokenVersion();

    clearAccessToken();
    const logoutGeneration = getAccessTokenVersion();

    expect(getAccessToken()).toBeNull();
    expect(logoutGeneration).toBeGreaterThan(firstGeneration);
    setAccessToken("second-login-token");
    expect(getAccessTokenVersion()).toBeGreaterThan(logoutGeneration);
    expect(getAccessToken()).toBe("second-login-token");
  });
});
