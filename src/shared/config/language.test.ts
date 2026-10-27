import { expect, it } from "vitest";

import { localeCodes } from "../i18n/locales";
import { defaultLanguage, normalizeLanguage } from "./language";

it("keeps Persian as a fixed bootstrap language", () => {
  expect(defaultLanguage).toBe("fa");
});

it.each(localeCodes)("normalizes only registered %s language codes", (code) => {
  expect(normalizeLanguage(code)).toBe(code);
  expect(normalizeLanguage(code.toUpperCase() + "-REGION")).toBe(code);
  expect(normalizeLanguage(code + "_REGION")).toBe(code);
});

it.each(["", "xx", " english", "fa ", "-fa"])(
  "rejects unsupported code %j",
  (value) => {
    expect(normalizeLanguage(value)).toBeUndefined();
  },
);
