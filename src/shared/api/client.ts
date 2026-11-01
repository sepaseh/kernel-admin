import type {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import axios, { AxiosError } from "axios";

import { i18nInstance } from "../i18n/index.ts";
import { toCamelCase, toSnakeCase } from "../lib/transform.ts";
import { apiUrl } from "./config.ts";
import {
  clearAccessToken,
  getAccessToken,
  getAccessTokenVersion,
  setRefreshedAccessToken,
} from "./token.ts";
import { parseAccessToken } from "./token-response.ts";
import type { AccessTokenProps } from "./types.ts";
const api = axios.create({ baseURL: apiUrl, withCredentials: true });
const requestTimeout = 15_000;
api.defaults.timeout = requestTimeout;
const refreshUrl = "/auth/refresh-token";
const publicAuthUrls = new Set([
  "/auth/forgot-password",
  "/auth/login",
  "/auth/otp-request",
  "/auth/register",
  refreshUrl,
]);
const publicReadUrls = new Set(["/settings"]);

let onUnauthorized: (() => void) | null = null;
let isHandlingUnauthorized = false;
const refreshes = new Map<number, Promise<AccessTokenProps>>();

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _authVersion?: number;
  _retried?: boolean;
};

type ApiErrorBody = {
  cause?: unknown;
  message: string;
};

const isApiErrorBody = (value: unknown): value is ApiErrorBody => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return (
    "message" in value &&
    typeof value.message === "string" &&
    value.message.length > 0
  );
};

const handleUnauthorized = () => {
  if (isHandlingUnauthorized) return;

  isHandlingUnauthorized = true;
  clearAccessToken();
  onUnauthorized?.();
};

const refreshAccessToken = (): Promise<AccessTokenProps> => {
  const version = getAccessTokenVersion();
  const existing = refreshes.get(version);
  if (existing) return existing;
  const refresh = axios
    .post<unknown>(refreshUrl, undefined, {
      baseURL: apiUrl,
      withCredentials: true,
      timeout: requestTimeout,
    })
    .then(({ data }) => {
      if (getAccessTokenVersion() !== version) throw new axios.CanceledError();
      const result = parseAccessToken(toCamelCase(data));
      setRefreshedAccessToken(result.accessToken);
      return result;
    })
    .finally(() => {
      if (refreshes.get(version) === refresh) refreshes.delete(version);
    });
  refreshes.set(version, refresh);
  return refresh;
};

const waitForRefresh = (
  refresh: Promise<AccessTokenProps>,
  signal: InternalAxiosRequestConfig["signal"],
) =>
  new Promise<AccessTokenProps>((resolve, reject) => {
    const abort = () => reject(new axios.CanceledError());
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener?.("abort", abort, { once: true });
    refresh
      .then(resolve, reject)
      .finally(() => signal?.removeEventListener?.("abort", abort));
  });

const retryUnauthorizedRequest = async (
  error: AxiosError<unknown>,
): Promise<AxiosResponse<unknown> | undefined> => {
  if (error.response?.status !== 401) return;

  const requestConfig = error.config as RetryableRequestConfig | undefined;
  if (requestConfig?.signal?.aborted) throw new axios.CanceledError();
  const isPublicAuthRequest = publicAuthUrls.has(requestConfig?.url ?? "");
  const version = requestConfig?._authVersion;
  // A 401 without its dispatch generation cannot authorize changing whichever
  // account happens to be signed in now. Public settings reads are unstamped.
  if (!requestConfig || version === undefined || isPublicAuthRequest) return;
  if (version !== getAccessTokenVersion()) throw new axios.CanceledError();
  if (requestConfig._retried) throw expireUnauthorized(error);

  requestConfig._retried = true;

  try {
    await waitForRefresh(refreshAccessToken(), requestConfig.signal);
    if (version !== getAccessTokenVersion()) throw new axios.CanceledError();
    if (requestConfig.signal?.aborted) throw new axios.CanceledError();
    return api.request(requestConfig);
  } catch (refreshError) {
    if (axios.isCancel(refreshError)) throw refreshError;
    if (version !== getAccessTokenVersion()) throw new axios.CanceledError();
    if (
      axios.isAxiosError(refreshError) &&
      [401, 403].includes(refreshError.response?.status ?? 0)
    ) {
      throw expireUnauthorized(error);
    }
    throw normalizeTransportError(refreshError);
  }
};

export class AdminApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "AdminApiError";
    this.status = status;
  }
}

const normalizeTransportError = (error: unknown): Error => {
  if (error instanceof AdminApiError) return error;
  if (axios.isAxiosError(error)) {
    if (error.response)
      return createResponseError(
        error.response.data,
        error.response.headers["x-request-id"],
        error.response.status,
      );
    if (
      [AxiosError.ETIMEDOUT, AxiosError.ECONNABORTED].includes(error.code ?? "")
    )
      return new AdminApiError(i18nInstance.t("requestTimeout"));
    if (error.request) return new AdminApiError(i18nInstance.t("networkError"));
  }
  return new AdminApiError(i18nInstance.t("unexpectedError"));
};

const expireUnauthorized = (error: AxiosError<unknown>): Error => {
  const responseError = normalizeTransportError(error);
  handleUnauthorized();
  return responseError;
};

const createResponseError = (
  data: unknown,
  requestId: unknown,
  status?: number,
): Error => {
  const error = isApiErrorBody(data)
    ? new AdminApiError(data.message, status, { cause: data.cause })
    : new AdminApiError(i18nInstance.t("unexpectedError"), status);
  return typeof requestId === "string" && /^[\w=-]{1,128}$/.test(requestId)
    ? Object.assign(error, { requestId })
    : error;
};

api.interceptors.request.use(
  (config) => {
    const version = getAccessTokenVersion();
    const original = (config as RetryableRequestConfig)._authVersion;
    if (original !== undefined && original !== version)
      throw new axios.CanceledError();
    const authToken = getAccessToken();
    const publicRead =
      ["get", "head"].includes(config.method?.toLowerCase() ?? "get") &&
      publicReadUrls.has(config.url ?? "");
    const current = {
      ...config,
      _authVersion: publicRead ? undefined : version,
    };
    if (!authToken) return current;

    isHandlingUnauthorized = false;
    return {
      ...current,
      headers: config.headers.setAuthorization(`Bearer ${authToken}`),
    };
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    const version = (response.config as RetryableRequestConfig)._authVersion;
    if (version !== undefined && version !== getAccessTokenVersion())
      throw new axios.CanceledError();
    return response;
  },
  async (error) => {
    if (axios.isCancel(error)) throw error;

    if (error instanceof AdminApiError) throw error;

    if (!axios.isAxiosError<unknown>(error)) {
      throw new Error(i18nInstance.t("unexpectedError"));
    }

    const version = (error.config as RetryableRequestConfig | undefined)
      ?._authVersion;
    if (version !== undefined && version !== getAccessTokenVersion())
      throw new axios.CanceledError();

    const retryResponse = await retryUnauthorizedRequest(error);
    if (version !== undefined && version !== getAccessTokenVersion())
      throw new axios.CanceledError();
    if (retryResponse) return retryResponse;

    throw normalizeTransportError(error);
  },
);

const bindGeneration = (
  url: string,
  method: string,
  config?: AxiosRequestConfig,
): AxiosRequestConfig & { _authVersion?: number } => ({
  ...config,
  _authVersion:
    ["get", "head"].includes(method) && publicReadUrls.has(url)
      ? undefined
      : getAccessTokenVersion(),
});

const assertGeneration = (request: ReturnType<typeof bindGeneration>) => {
  if (
    request._authVersion !== undefined &&
    request._authVersion !== getAccessTokenVersion()
  )
    throw new axios.CanceledError();
};

const blob = async (
  url: string,
  config?: AxiosRequestConfig,
): Promise<Blob> => {
  const request = bindGeneration(url, "get", config);
  const { data } = await api.get<Blob>(url, {
    ...request,
    responseType: "blob",
  });
  assertGeneration(request);
  return data;
};

const del = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const request = bindGeneration(url, "delete", config);
  const { data } = await api.delete<unknown>(url, request);
  assertGeneration(request);
  return toCamelCase(data) as T;
};

const get = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const request = bindGeneration(url, "get", config);
  const { data } = await api.get<unknown>(url, request);
  assertGeneration(request);
  return toCamelCase(data) as T;
};

const patch = async <T>(
  url: string,
  data?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const request = bindGeneration(url, "patch", config);
  const response = await api.patch<unknown>(url, toSnakeCase(data), request);
  assertGeneration(request);
  return toCamelCase(response.data) as T;
};

const post = async <T>(
  url: string,
  data?: FormData | Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const request = bindGeneration(url, "post", config);
  const response = await api.post<unknown>(url, toSnakeCase(data), request);
  assertGeneration(request);
  return toCamelCase(response.data) as T;
};

const put = async <T>(
  url: string,
  data?: FormData | Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const request = bindGeneration(url, "put", config);
  const response = await api.put<unknown>(url, toSnakeCase(data), request);
  assertGeneration(request);
  return toCamelCase(response.data) as T;
};

export const apiClient = { blob, del, get, patch, post, put };

export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};
