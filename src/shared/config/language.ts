import type { LocaleCode } from "../i18n/locales";
import { localeCodes } from "../i18n/locales";

export type Language = LocaleCode;

export const defaultLanguage: Language = "fa";

const registeredLanguages: readonly string[] = localeCodes;
const isLanguage = (value: string): value is Language =>
  registeredLanguages.includes(value);

export const normalizeLanguage = (value: string): Language | undefined => {
  const language = value.split(/[-_]/, 1)[0]?.toLowerCase();

  return language && isLanguage(language) ? language : undefined;
};
