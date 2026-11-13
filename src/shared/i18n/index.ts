import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { catalogs } from "./catalogs.ts";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      translation: typeof catalogs.en;
    };
  }
}

const i18nInstance = i18n.use(initReactI18next);

await i18nInstance.init({
  debug: false,
  defaultNS: "translation",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  lng: "en",
  parseMissingKeyHandler: (key) => {
    console.warn(`Missing translation key: ${key}`);
    return key;
  },
  resources: Object.fromEntries(
    Object.entries(catalogs).map(([lang, translation]) => [
      lang,
      { translation },
    ]),
  ),
  returnEmptyString: false,
  returnNull: false,
});

export { i18nInstance as i18n, i18nInstance };

export { dayjsLocaleName } from "./date";
export type { LocaleCode } from "./locales";
