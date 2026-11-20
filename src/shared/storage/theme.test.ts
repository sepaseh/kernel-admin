// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { storageKeys } from "@/shared/config";

import { getTheme, setTheme } from "./theme";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("browser theme preference", () => {
  it("defaults to dark and round trips the light theme", () => {
    expect(getTheme()).toBe("dark");

    setTheme("light");
    expect(getTheme()).toBe("light");
    expect(localStorage.getItem(storageKeys.theme)).toBe('"light"');
    expect(localStorage).toHaveLength(1);
  });

  it.each(["invalid", "null", "{}", '"blue"', "1"])(
    "rejects corrupt theme %s",
    (value) => {
      localStorage.setItem(storageKeys.theme, value);
      expect(getTheme()).toBe("dark");
    },
  );
});
