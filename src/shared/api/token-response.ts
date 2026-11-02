import { i18nInstance } from "../i18n/index.ts";
import type { AccessTokenProps } from "./types.ts";

export const parseAccessToken = (value: unknown): AccessTokenProps => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("accessToken" in value) ||
    typeof value.accessToken !== "string" ||
    !value.accessToken.trim()
  )
    throw new Error(i18nInstance.t("unexpectedError"));

  return { accessToken: value.accessToken };
};
