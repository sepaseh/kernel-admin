import { apiClient } from "../../shared/api/index.ts";
import { normalizeLanguage } from "../../shared/config/language.ts";
import type { ThemeColors } from "../../shared/contracts/appearance.ts";
import { themeColorFields } from "../../shared/contracts/appearance.ts";
import { i18nInstance } from "../../shared/i18n/index.ts";
import type {
  ApplicationLanguage,
  ApplicationSettings,
  ApplicationSettingsRequest,
} from "./types.ts";

const basePath = "/settings";
const languagesPath = "/languages";

const invalidSettings = () =>
  new Error(i18nInstance.t("unexpectedError"), {
    cause: new Error("Invalid application settings metadata"),
  });

const normalizeApplicationLanguage = (value: unknown): ApplicationLanguage => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw invalidSettings();

  const language = value as Record<string, unknown>;
  const code =
    typeof language.code === "string" &&
    /^[a-z]{2}(?:[-_][a-z0-9]{2,8})*$/i.test(language.code)
      ? normalizeLanguage(language.code)
      : undefined;
  if (
    !code ||
    (language.direction !== "ltr" && language.direction !== "rtl") ||
    (language.calendar !== "gregorian" && language.calendar !== "jalali") ||
    typeof language.name !== "string" ||
    !language.name.trim() ||
    typeof language.nativeName !== "string" ||
    !language.nativeName.trim()
  )
    throw invalidSettings();

  return {
    calendar: language.calendar,
    code,
    direction: language.direction,
    name: language.name,
    nativeName: language.nativeName,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeTheme = (value: unknown): ThemeColors => {
  if (
    !isRecord(value) ||
    themeColorFields.some((field) => typeof value[field] !== "string")
  )
    throw invalidSettings();
  return Object.fromEntries(
    themeColorFields.map((field) => [field, value[field]]),
  ) as ThemeColors;
};

const normalizeLogo = (value: unknown): ApplicationSettings["darkLogo"] => {
  if (value === undefined) return undefined;
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.url !== "string" ||
    !value.url.trim()
  )
    throw invalidSettings();
  return { id: value.id, url: value.url };
};

const normalizeApplicationSettings = (
  settings: unknown,
): ApplicationSettings => {
  if (!isRecord(settings)) throw invalidSettings();
  return {
    darkLogo: normalizeLogo(settings.darkLogo),
    darkTheme: normalizeTheme(settings.darkTheme),
    language: normalizeApplicationLanguage(settings.language),
    lightLogo: normalizeLogo(settings.lightLogo),
    lightTheme: normalizeTheme(settings.lightTheme),
  };
};

export const fetchApplicationSettings = (
  signal?: AbortSignal,
): Promise<ApplicationSettings> =>
  apiClient
    .get<unknown>(basePath, { signal })
    .then(normalizeApplicationSettings);

export const fetchLanguages = (
  signal?: AbortSignal,
): Promise<ApplicationLanguage[]> =>
  apiClient.get<unknown>(languagesPath, { signal }).then((languages) => {
    if (!Array.isArray(languages)) throw invalidSettings();
    return languages.map(normalizeApplicationLanguage);
  });

export const updateApplicationSettings = (
  params: ApplicationSettingsRequest,
): Promise<ApplicationSettings> =>
  apiClient.put<unknown>(basePath, params).then(normalizeApplicationSettings);
