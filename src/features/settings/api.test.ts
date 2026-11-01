import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../shared/api/index.ts";
import { i18nInstance } from "../../shared/i18n/index.ts";
import { localeCodes } from "../../shared/i18n/locales.ts";
import {
  fetchApplicationSettings,
  fetchLanguages,
  updateApplicationSettings,
} from "./api.ts";
import type { ApplicationSettings } from "./types.ts";

vi.mock("../../shared/api/index.ts", () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
}));

const settings: ApplicationSettings = {
  darkTheme: {
    colorBgBase: "#141414",
    colorBgContainer: "#1f1f1f",
    colorBorder: "#424242",
    colorLink: "#1668dc",
    colorPrimary: "#1677ff",
    colorTextBase: "#ffffff",
    colorTextDescription: "#bfbfbf",
  },
  language: {
    calendar: "jalali",
    code: "fa",
    direction: "rtl",
    name: "Persian",
    nativeName: "فارسی",
  },
  lightTheme: {
    colorBgBase: "#ffffff",
    colorBgContainer: "#ffffff",
    colorBorder: "#d9d9d9",
    colorLink: "#1677ff",
    colorPrimary: "#1677ff",
    colorTextBase: "#000000",
    colorTextDescription: "#8c8c8c",
  },
};

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue(settings);
  vi.mocked(apiClient.put).mockResolvedValue(settings);
});

describe("settings API", () => {
  it.each([null, [], "settings", 42, {}, { language: settings.language }])(
    "rejects a malformed settings envelope with a localized controlled error: %j",
    async (response) => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(response);
      await expect(fetchApplicationSettings()).rejects.toThrow(
        i18nInstance.t("unexpectedError"),
      );
    },
  );

  it.each(localeCodes)(
    "preserves complete server-owned metadata for %s without deriving direction or calendar from its code",
    async (code) => {
      const language = {
        calendar: "jalali",
        code,
        direction: "rtl",
        name: "Server name",
        nativeName: "Server native name",
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ ...settings, language });
      await expect(fetchApplicationSettings()).resolves.toHaveProperty(
        "language",
        language,
      );
    },
  );

  it.each([
    { ...settings, darkTheme: null },
    { ...settings, lightTheme: {} },
    { ...settings, darkTheme: { ...settings.darkTheme, colorPrimary: 42 } },
    { ...settings, darkLogo: {} },
    { ...settings, lightLogo: { id: "id", url: " " } },
  ])(
    "rejects malformed branding contracts instead of forwarding unsafe shapes: %j",
    async (response) => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(response);
      await expect(fetchApplicationSettings()).rejects.toThrow(
        i18nInstance.t("unexpectedError"),
      );
    },
  );

  it("preserves optional server logos and empty palette overrides", async () => {
    const response = {
      ...settings,
      darkLogo: { id: "dark", url: "/files/dark" },
      lightLogo: { id: "light", url: "/files/light" },
      darkTheme: { ...settings.darkTheme, colorPrimary: "" },
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(response);
    await expect(fetchApplicationSettings()).resolves.toEqual(response);
  });

  it("loads settings and supported languages", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(settings)
      .mockResolvedValueOnce([settings.language]);

    const controller = new AbortController();
    await fetchApplicationSettings(controller.signal);
    await fetchLanguages(controller.signal);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/settings", {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/languages", {
      signal: controller.signal,
    });
  });

  it("normalizes regional language codes", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      ...settings,
      language: {
        ...settings.language,
        calendar: "gregorian",
        code: "fa-IR",
        direction: "ltr",
        name: "Server Persian",
        nativeName: "Server native Persian",
      },
    });

    await expect(fetchApplicationSettings()).resolves.toMatchObject({
      language: {
        calendar: "gregorian",
        code: "fa",
        direction: "ltr",
        name: "Server Persian",
        nativeName: "Server native Persian",
      },
    });
  });

  it.each([
    null,
    [],
    {},
    { ...settings.language, code: "xx" },
    { ...settings.language, code: "fa-" },
    { ...settings.language, code: 42 },
    { ...settings.language, direction: "auto" },
    { ...settings.language, direction: undefined },
    { ...settings.language, calendar: "hebrew" },
    { ...settings.language, calendar: undefined },
    { ...settings.language, name: " " },
    { ...settings.language, nativeName: 42 },
  ])(
    "rejects invalid API language metadata instead of replacing it locally: %j",
    async (language) => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ ...settings, language });
      await expect(fetchApplicationSettings()).rejects.toThrow(
        i18nInstance.t("unexpectedError"),
      );
    },
  );

  it("validates language-list and mutation responses through the same boundary", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      language: settings.language,
    });
    await expect(fetchLanguages()).rejects.toThrow(
      i18nInstance.t("unexpectedError"),
    );
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...settings.language, direction: "auto" },
    ]);
    await expect(fetchLanguages()).rejects.toThrow(
      i18nInstance.t("unexpectedError"),
    );
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      ...settings,
      language: { ...settings.language, calendar: "unknown" },
    });
    await expect(
      updateApplicationSettings({
        darkTheme: settings.darkTheme,
        lightTheme: settings.lightTheme,
      }),
    ).rejects.toThrow(i18nInstance.t("unexpectedError"));
  });

  it("updates the complete settings payload", async () => {
    const request = {
      darkTheme: settings.darkTheme,
      languageCode: settings.language.code,
      lightTheme: settings.lightTheme,
    };

    await updateApplicationSettings(request);

    expect(apiClient.put).toHaveBeenCalledWith("/settings", request);
  });

  it("forwards optional mutation cancellation without changing the settings payload", async () => {
    const controller = new AbortController();
    const request = {
      darkTheme: settings.darkTheme,
      lightTheme: settings.lightTheme,
    };
    await expect(
      updateApplicationSettings(request, controller.signal),
    ).resolves.toEqual(settings);
    expect(apiClient.put).toHaveBeenCalledWith("/settings", request, {
      signal: controller.signal,
    });
  });
});
