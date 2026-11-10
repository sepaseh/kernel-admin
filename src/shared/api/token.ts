import { i18n } from "@/shared/i18n";
import type { AccessTokenProps } from "./types.ts";

let accessToken: string | null = null;
let session = new AbortController();

export const clearAccessToken = () => {
  session.abort();
  session = new AbortController();
  accessToken = null;
};

export const getAccessToken = () => accessToken;
export const getSessionSignal = () => session.signal;

export const setRefreshedAccessToken = (token: string) => {
  accessToken = token;
};

export const setAccessToken = (token: string) => {
  clearAccessToken();
  accessToken = token;
};

export const parseAccessToken = (value: unknown): AccessTokenProps => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("accessToken" in value) ||
    typeof value.accessToken !== "string" ||
    !value.accessToken.trim()
  )
    throw new Error(i18n.t("unexpectedError"));

  return { accessToken: value.accessToken };
};
