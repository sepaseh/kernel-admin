import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { catalogs } from "./catalogs";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      translation: typeof catalogs.en;
    };
  }
}

await i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  resources: Object.fromEntries(
    Object.entries(catalogs).map(([code, translation]) => [
      code,
      { translation },
    ]),
  ),
});

export { i18n };

export { dayjsLocaleName } from "./date";
export type { LocaleCode } from "./locales";
