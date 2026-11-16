import axios from "axios";

import { toCamelCase } from "@/shared/lib";

import { apiUrl } from "./config";
import { parseAccessToken, setRefreshedAccessToken } from "./token";
import type { AccessTokenProps } from "./types";

const pendingRefreshes = new WeakMap<AbortSignal, Promise<AccessTokenProps>>();
const refreshTimeout = 15_000;

const waitForRetry = (signal: AbortSignal): Promise<void> => {
  if (signal.aborted) return Promise.reject(new axios.CanceledError());

  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timeout);
      reject(new axios.CanceledError());
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 1_000);

    signal.addEventListener("abort", abort, { once: true });
  });
};

const requestRefresh = async (
  signal: AbortSignal,
): Promise<AccessTokenProps> => {
  const { data } = await axios.post<unknown>("/auth/refresh-token", undefined, {
    baseURL: apiUrl,
    signal,
    timeout: refreshTimeout,
    withCredentials: true,
  });
  if (signal.aborted) throw new axios.CanceledError();

  return parseAccessToken(toCamelCase(data));
};

const refreshWithRetry = async (
  signal: AbortSignal,
): Promise<AccessTokenProps> => {
  let result: AccessTokenProps;

  try {
    result = await requestRefresh(signal);
  } catch (error) {
    if (signal.aborted) throw new axios.CanceledError();
    if (
      axios.isCancel(error) ||
      !axios.isAxiosError(error) ||
      (error.response &&
        (error.response.status < 500 || error.response.status >= 600))
    )
      throw error;

    await waitForRetry(signal);
    result = await requestRefresh(signal);
  }

  if (signal.aborted) throw new axios.CanceledError();

  setRefreshedAccessToken(result.accessToken);
  return result;
};

export const refreshAccessToken = async (
  sessionSignal: AbortSignal,
): Promise<AccessTokenProps> => {
  if (sessionSignal.aborted) throw new axios.CanceledError();

  const existing = pendingRefreshes.get(sessionSignal);
  if (existing) return await existing;

  const refresh = refreshWithRetry(sessionSignal);
  pendingRefreshes.set(sessionSignal, refresh);

  try {
    return await refresh;
  } finally {
    pendingRefreshes.delete(sessionSignal);
  }
};
