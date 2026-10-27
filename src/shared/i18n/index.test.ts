import { afterEach, expect, it, vi } from "vitest";

import { defaultLanguage } from "../config/language";
import { catalogs } from "./catalogs";
import { localeCodes } from "./locales";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("bootstraps in Persian without reading or writing a visitor language", async () => {
  const storage = { getItem: vi.fn(() => '"en"'), setItem: vi.fn() };
  vi.stubGlobal("localStorage", storage);
  vi.resetModules();
  const { i18nInstance } = await import("./index");
  await i18nInstance.init();
  expect(i18nInstance.resolvedLanguage).toBe(defaultLanguage);
  expect(i18nInstance.t("login")).toBe(catalogs.fa.login);
  expect(storage.getItem).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it("registers every complete local catalog with the real translation engine", async () => {
  const { i18nInstance } = await import("./index");
  await i18nInstance.init();
  for (const code of localeCodes) {
    expect(i18nInstance.getResourceBundle(code, "translation")).toEqual(
      catalogs[code],
    );
    expect(i18nInstance.t("login", { lng: code })).toBe(catalogs[code].login);
  }
});

it("uses Persian fallback and reports missing keys without swallowing their identity", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const { i18nInstance } = await import("./index");
  expect(i18nInstance.t("login", { lng: "xx" })).toBe(catalogs.fa.login);
  expect(
    i18nInstance.t("syntheticMissingKey", {
      defaultValue: "syntheticMissingKey",
    }),
  ).toBe("syntheticMissingKey");
  expect(warn).toHaveBeenCalledWith(
    "Missing translation key: syntheticMissingKey",
  );
});
