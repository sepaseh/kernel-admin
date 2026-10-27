// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getState, setState } from "./state";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storage state", () => {
  it("returns the initial value when the key is missing", () => {
    expect(getState("missing", { enabled: true })).toEqual({ enabled: true });
  });

  it("returns the fallback when access to local storage is denied", () => {
    vi.spyOn(globalThis, "localStorage", "get").mockImplementation(() => {
      throw new DOMException(
        "Synthetic storage access denied",
        "SecurityError",
      );
    });

    expect(getState("theme", "light")).toBe("light");
  });

  it("returns the fallback when reading local storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Synthetic storage read denied", "SecurityError");
    });

    expect(getState("compact", false)).toBe(false);
  });

  it("warns and continues when the browser cannot persist a preference", () => {
    const failure = new DOMException(
      "Synthetic full storage",
      "QuotaExceededError",
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw failure;
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => setState("theme", "dark")).not.toThrow();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Could not persist browser state.",
      failure,
    );
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("returns invalid JSON as its raw string value", () => {
    localStorage.setItem("invalid", "not-json");

    expect(getState("invalid", "fallback")).toBe("not-json");
  });

  it("serializes and restores values", () => {
    const value = { enabled: true, retries: 2 };

    setState("settings", value);

    expect(localStorage.getItem("settings")).toBe(JSON.stringify(value));
    expect(getState("settings", {})).toEqual(value);
  });

  it("rejects circular values without storing lossy data", () => {
    const value: { self?: unknown } = {};
    value.self = value;

    expect(() => setState("circular", value)).toThrow(TypeError);
    expect(localStorage.getItem("circular")).toBeNull();
  });

  it("rejects values that JSON cannot serialize", () => {
    expect(() => setState("undefined", undefined)).toThrow(
      "State value is not JSON-serializable",
    );
    expect(localStorage.getItem("undefined")).toBeNull();
  });
});
