// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { storageKeys } from "@/shared/config";

import { getCompact, setCompact } from "./compact";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("browser compact preference", () => {
  it("defaults to noncompact controls and round trips compact mode", () => {
    expect(getCompact()).toBe(false);

    setCompact(true);
    expect(getCompact()).toBe(true);
    expect(localStorage.getItem(storageKeys.compact)).toBe("true");
    expect(localStorage).toHaveLength(1);
  });

  it.each(["invalid", "null", "{}", '"false"', "1"])(
    "rejects corrupt compact preference %s",
    (value) => {
      localStorage.setItem(storageKeys.compact, value);
      expect(getCompact()).toBe(false);
    },
  );
});
