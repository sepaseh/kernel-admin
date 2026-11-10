import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { storageKeys } from "@/shared/config";

import { getCompact, setCompact } from "./compact";
import { getTheme, setTheme } from "./theme";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("browser appearance preferences", () => {
  it("defaults to dark, noncompact controls and round trips accepted choices", () => {
    expect(getTheme()).toBe("dark");
    expect(getCompact()).toBe(false);

    setTheme("light");
    setCompact(true);

    expect(getTheme()).toBe("light");
    expect(getCompact()).toBe(true);
    expect(localStorage.getItem(storageKeys.theme)).toBe('"light"');
    expect(localStorage.getItem(storageKeys.compact)).toBe("true");
    expect(localStorage.length).toBe(2);
  });

  it.each(["invalid", "null", "{}", '"blue"', "1"])(
    "rejects corrupt theme %s",
    (value) => {
      localStorage.setItem(storageKeys.theme, value);
      expect(getTheme()).toBe("dark");
    },
  );

  it.each(["invalid", "null", "{}", '"false"', "1"])(
    "rejects corrupt compact preference %s",
    (value) => {
      localStorage.setItem(storageKeys.compact, value);
      expect(getCompact()).toBe(false);
    },
  );
});
