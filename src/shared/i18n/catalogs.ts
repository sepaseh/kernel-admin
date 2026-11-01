import type { LocaleCode } from "./locales.ts";
import { ar } from "./locales/ar.ts";
import { de } from "./locales/de.ts";
import type { TranslationCatalog } from "./locales/en.ts";
import { en } from "./locales/en.ts";
import { es } from "./locales/es.ts";
import { fa } from "./locales/fa.ts";
import { fr } from "./locales/fr.ts";
import { it } from "./locales/it.ts";
import { pt } from "./locales/pt.ts";
import { ru } from "./locales/ru.ts";
import { tr } from "./locales/tr.ts";

export const catalogs = {
  ar,
  de,
  en,
  es,
  fa,
  fr,
  it,
  pt,
  ru,
  tr,
} satisfies Record<LocaleCode, TranslationCatalog>;
