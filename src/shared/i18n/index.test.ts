import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "./catalogs";
import { localeCodes } from "./locales";

afterEach(async () => {
  vi.unstubAllGlobals();
  const { i18n } = await import("./index");
  await i18n.changeLanguage("en");
});

describe("translation engine integration", () => {
  it("bootstraps in English without reading or persisting a browser language", async () => {
    const storage = { getItem: vi.fn(() => '"fa"'), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    vi.resetModules();

    const { i18n } = await import("./index");

    expect(i18n.isInitialized).toBe(true);
    expect(i18n.resolvedLanguage).toBe("en");
    expect(i18n.t("login")).toBe(catalogs.en.login);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("registers all ten catalogs with the real translation engine", async () => {
    const { i18n } = await import("./index");

    for (const code of localeCodes) {
      expect(i18n.getResourceBundle(code, "translation")).toEqual(
        catalogs[code],
      );
      await i18n.changeLanguage(code);
      expect(i18n.resolvedLanguage).toBe(code);
      expect(i18n.t("login")).toBe(catalogs[code].login);
    }
  });

  it("falls back to a complete English catalog for unsupported languages", async () => {
    const { i18n } = await import("./index");
    await i18n.changeLanguage("synthetic-unsupported");
    expect(i18n.resolvedLanguage).toBe("en");
    expect(i18n.t("login")).toBe(catalogs.en.login);
    expect(i18n.t("passwordMismatch")).toBe(catalogs.en.passwordMismatch);
  });
});
