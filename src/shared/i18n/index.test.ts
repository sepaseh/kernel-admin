import { afterEach, expect, it, vi } from "vitest";

import { catalogs } from "./catalogs";
import { localeCodes } from "./locales";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("bootstraps in English without reading or mutating a visitor language", async () => {
  const storage = {
    getItem: vi.fn(() => '"fa"'),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  };
  vi.stubGlobal("localStorage", storage);
  vi.resetModules();
  const { i18n, i18nInstance } = await import("./index");
  expect(i18n).toBe(i18nInstance);
  expect(i18nInstance.isInitialized).toBe(true);
  expect(i18nInstance.resolvedLanguage).toBe("en");
  expect(i18nInstance.t("login")).toBe(catalogs.en.login);
  expect(storage.getItem).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
});

it("registers every complete local catalog with the real translation engine", async () => {
  const { i18nInstance } = await import("./index");
  expect(i18nInstance.isInitialized).toBe(true);
  for (const code of localeCodes) {
    expect(i18nInstance.getResourceBundle(code, "translation")).toEqual(
      catalogs[code],
    );
    await i18nInstance.changeLanguage(code);
    expect(i18nInstance.resolvedLanguage).toBe(code);
    expect(i18nInstance.t("login")).toBe(catalogs[code].login);
  }
  await i18nInstance.changeLanguage("en");
});

it("uses English fallback and reports missing keys without swallowing their identity", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const { i18nInstance } = await import("./index");
  expect(i18nInstance.t("login", { lng: "xx" })).toBe(catalogs.en.login);
  expect(
    i18nInstance.t("syntheticMissingKey", {
      defaultValue: "syntheticMissingKey",
    }),
  ).toBe("syntheticMissingKey");
  expect(warn).toHaveBeenCalledWith(
    "Missing translation key: syntheticMissingKey",
  );
});

it("rejects module loading when translation initialization fails", async () => {
  const failure = new Error("Synthetic translation initialization failure");
  vi.doMock("i18next", () => ({
    default: {
      use: () => ({
        init: async () => {
          throw failure;
        },
      }),
    },
  }));
  vi.resetModules();
  try {
    await expect(import("./index")).rejects.toBe(failure);
  } finally {
    vi.doUnmock("i18next");
    vi.resetModules();
  }
});
