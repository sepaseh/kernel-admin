import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  AxiosError,
} from "axios";

import { i18n } from "@/shared/i18n";
import { toCamelCase, toSnakeCase } from "@/shared/lib";
import { apiUrl } from "./config.ts";
import { refreshAccessToken } from "./refresh";
import { clearAccessToken, getAccessToken, getSessionSignal } from "./token.ts";
import type { AccessTokenProps } from "./types.ts";

type ApiErrorBody = {
  cause?: unknown;
  message: string;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
  _sessionSignal?: AbortSignal;
};

const api = axios.create({ baseURL: apiUrl, withCredentials: true });
const refreshUrl = "/auth/refresh-token";
const publicAuthUrls = new Set([
  "/auth/forgot-password",
  "/auth/login",
  "/auth/otp-request",
  "/auth/register",
  refreshUrl,
]);
const publicReadUrls = new Set(["/settings"]);

let isHandlingUnauthorized = false;
let onUnauthorized: (() => void) | null = null;

export class AdminApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "AdminApiError";
    this.status = status;
  }
}

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

const createResponseError = (
  data: unknown,
  requestId: unknown,
  status?: number,
): Error => {
  const error = isApiErrorBody(data)
    ? new AdminApiError(data.message, status, { cause: data.cause })
    : new AdminApiError(i18n.t("unexpectedError"), status);
  return typeof requestId === "string" && /^[\w=-]{1,128}$/.test(requestId)
    ? Object.assign(error, { requestId })
    : error;
};

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
      return new AdminApiError(i18n.t("requestTimeout"));
    if (error.request) return new AdminApiError(i18n.t("networkError"));
  }
  return new AdminApiError(i18n.t("unexpectedError"));
};

const handleUnauthorized = () => {
  if (isHandlingUnauthorized) return;

  isHandlingUnauthorized = true;
  clearAccessToken();
  onUnauthorized?.();
};

const expireUnauthorized = (error: AxiosError<unknown>): Error => {
  const responseError = normalizeTransportError(error);
  handleUnauthorized();
  return responseError;
};

const waitForRefresh = async (
  refresh: Promise<AccessTokenProps>,
  signal: InternalAxiosRequestConfig["signal"],
): Promise<AccessTokenProps> => {
  if (!signal) return await refresh;
  if (signal.aborted) throw new axios.CanceledError();

  let abort: (() => void) | undefined;
  const canceled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new axios.CanceledError());
    signal.addEventListener?.("abort", abort, { once: true });
  });

  try {
    return await Promise.race([refresh, canceled]);
  } finally {
    if (abort) signal.removeEventListener?.("abort", abort);
  }
};

const retryUnauthorizedRequest = async (
  error: AxiosError<unknown>,
): Promise<AxiosResponse<unknown> | undefined> => {
  if (error.response?.status !== 401) return;

  const requestConfig = error.config as RetryableRequestConfig | undefined;
  if (requestConfig?.signal?.aborted) throw new axios.CanceledError();
  const isPublicAuthRequest = publicAuthUrls.has(requestConfig?.url ?? "");
  const sessionSignal = requestConfig?._sessionSignal;
  if (!requestConfig || !sessionSignal || isPublicAuthRequest) return;

  if (sessionSignal.aborted) throw new axios.CanceledError();
  if (requestConfig._retried) throw expireUnauthorized(error);

  requestConfig._retried = true;

  try {
    await waitForRefresh(
      refreshAccessToken(sessionSignal),
      requestConfig.signal,
    );
    if (sessionSignal.aborted) throw new axios.CanceledError();
    if (requestConfig.signal?.aborted) throw new axios.CanceledError();
    return api.request(requestConfig);
  } catch (refreshError) {
    if (axios.isCancel(refreshError)) throw refreshError;
    if (sessionSignal.aborted) throw new axios.CanceledError();
    const failure = normalizeTransportError(refreshError);
    const transientFailure =
      axios.isAxiosError(refreshError) &&
      (!refreshError.response ||
        (refreshError.response.status >= 500 &&
          refreshError.response.status < 600));
    if (!transientFailure) handleUnauthorized();
    throw failure;
  }
};

const bindRequest = (
  url: string,
  method: string,
  config?: AxiosRequestConfig,
): AxiosRequestConfig & { _sessionSignal?: AbortSignal } => {
  const publicRequest =
    publicAuthUrls.has(url) ||
    (["get", "head"].includes(method) && publicReadUrls.has(url));
  if (publicRequest) return { ...config };

  const signal = getSessionSignal();
  return {
    ...config,
    _sessionSignal: signal,
    signal: config?.signal
      ? AbortSignal.any([signal, config.signal as AbortSignal])
      : signal,
  };
};

const assertActive = (request: ReturnType<typeof bindRequest>) => {
  if (request.signal?.aborted) throw new axios.CanceledError();
};

const del = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const request = bindRequest(url, "delete", config);
  const { data } = await api.delete<unknown>(url, request);
  assertActive(request);
  return toCamelCase(data) as T;
};

const get = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const request = bindRequest(url, "get", config);
  const { data } = await api.get<unknown>(url, request);
  assertActive(request);
  return toCamelCase(data) as T;
};

const patch = async <T>(
  url: string,
  data?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const request = bindRequest(url, "patch", config);
  const response = await api.patch<unknown>(url, toSnakeCase(data), request);
  assertActive(request);
  return toCamelCase(response.data) as T;
};

const post = async <T>(
  url: string,
  data?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const request = bindRequest(url, "post", config);
  const response = await api.post<unknown>(url, toSnakeCase(data), request);
  assertActive(request);
  return toCamelCase(response.data) as T;
};

const put = async <T>(
  url: string,
  data?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const request = bindRequest(url, "put", config);
  const response = await api.put<unknown>(url, toSnakeCase(data), request);
  assertActive(request);
  return toCamelCase(response.data) as T;
};

const upload = async <T>(
  url: string,
  data: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const request = bindRequest(url, "post", config);
  const response = await api.postForm<unknown>(url, data, request);
  assertActive(request);
  return toCamelCase(response.data) as T;
};

api.interceptors.request.use(
  (config) => {
    const current = config as RetryableRequestConfig;
    if (current._sessionSignal?.aborted || current.signal?.aborted)
      throw new axios.CanceledError();
    const authToken = getAccessToken();
    if (!authToken) return current;

    isHandlingUnauthorized = false;
    return {
      ...current,
      headers: config.headers.setAuthorization(`Bearer ${authToken}`),
    };
  },
  (error) => {
    throw error;
  },
);

api.interceptors.response.use(
  (response) => {
    const signal = (response.config as RetryableRequestConfig)._sessionSignal;
    if (signal?.aborted || response.config.signal?.aborted)
      throw new axios.CanceledError();
    return response;
  },
  async (error) => {
    if (axios.isCancel(error)) throw error;

    if (error instanceof AdminApiError) throw error;

    if (!axios.isAxiosError<unknown>(error)) {
      throw new Error(i18n.t("unexpectedError"));
    }

    const signal = (error.config as RetryableRequestConfig | undefined)
      ?._sessionSignal;
    if (signal?.aborted || error.config?.signal?.aborted)
      throw new axios.CanceledError();

    if (
      signal !== undefined &&
      error.response?.status === 403 &&
      error.config?.url === "/account/me" &&
      error.config.method?.toLowerCase() === "get"
    ) {
      if (error.config.signal?.aborted) throw new axios.CanceledError();
      throw expireUnauthorized(error);
    }

    const retryResponse = await retryUnauthorizedRequest(error);
    if (signal?.aborted || error.config?.signal?.aborted)
      throw new axios.CanceledError();
    if (retryResponse) return retryResponse;

    throw normalizeTransportError(error);
  },
);

export const apiClient = { del, get, patch, post, put, upload };

export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};
