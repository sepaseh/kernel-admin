import type { Page } from "@playwright/test";

import type { LocaleCode } from "@/shared/i18n/locales";

export const syntheticCredential = "synthetic-test-credential";

export const fixtureDirections = {
  ar: "rtl",
  de: "ltr",
  en: "ltr",
  es: "ltr",
  fa: "rtl",
  fr: "ltr",
  it: "ltr",
  pt: "ltr",
  ru: "ltr",
  tr: "ltr",
} as const satisfies Record<LocaleCode, "ltr" | "rtl">;

export const applicationSettingsFixture = (language: LocaleCode = "en") => ({
  dark_theme: {
    color_bg_base: "#141414",
    color_bg_container: "#1f1f1f",
    color_border: "#424242",
    color_link: "#1668dc",
    color_primary: "#61dafb",
    color_text_base: "#ffffff",
    color_text_description: "#bfbfbf",
  },
  language: {
    calendar: language === "fa" ? "jalali" : "gregorian",
    code: language,
    direction: fixtureDirections[language],
    name: language,
    native_name: language,
  },
  light_theme: {
    color_bg_base: "#ffffff",
    color_bg_container: "#ffffff",
    color_border: "#d9d9d9",
    color_link: "#1677ff",
    color_primary: "#61dafb",
    color_text_base: "#000000",
    color_text_description: "#8c8c8c",
  },
});

export const mockApplicationSettings = async (
  page: Page,
  language: LocaleCode = "en",
) => {
  await page.route("https://api.example.com/settings", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: applicationSettingsFixture(language) })
      : route.fallback(),
  );
};
