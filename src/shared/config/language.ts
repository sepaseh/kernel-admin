import type { LocaleCode } from "../i18n/locales";
import { localeCodes } from "../i18n/locales";

export type Language = LocaleCode;

export const defaultLanguage: Language = "fa";

const isLanguage = (value: string): value is Language =>
  localeCodes.some((code) => code === value);

export const normalizeLanguage = (value: string): Language | undefined => {
  const language = value.split(/[-_]/, 1)[0]?.toLowerCase();

  return language && isLanguage(language) ? language : undefined;
};
