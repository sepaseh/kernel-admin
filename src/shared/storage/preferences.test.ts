// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { createThemeConfig, defaultTheme, storageKeys } from "@/shared/config";

import { getCompact, setCompact } from "./compact";
import { getTheme, setTheme } from "./theme";

beforeEach(() => {
  localStorage.clear();
});

describe("stored preferences", () => {
  it("uses the default preferences when values are missing", () => {
    expect(getCompact()).toBe(false);
    expect(getTheme()).toBe(defaultTheme);
  });

  it("updates compact mode", () => {
    setCompact(true);

    expect(getCompact()).toBe(true);
    expect(localStorage.getItem(storageKeys.compact)).toBe("true");
  });

  it("updates the theme", () => {
    setTheme("light");

    expect(getTheme()).toBe("light");
    expect(localStorage.getItem(storageKeys.theme)).toBe('"light"');
  });

  it.each(["invalid", "null", "{}", '"blue"', "1"])(
    "rejects corrupt stored theme %s before deriving Ant Design tokens",
    (value) => {
      localStorage.setItem(storageKeys.theme, value);
      expect(() => createThemeConfig(getTheme())).not.toThrow();
      expect(getTheme()).toBe(defaultTheme);
    },
  );

  it.each(["invalid", "null", "{}", '"false"', "1"])(
    "does not turn malformed compact preference %s into a truthy flag",
    (value) => {
      localStorage.setItem(storageKeys.compact, value);
      expect(getCompact()).toBe(false);
    },
  );
});
