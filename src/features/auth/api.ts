import { CanceledError } from "axios";

import type { AccessTokenProps } from "../../shared/api/index.ts";
import {
  apiClient,
  clearAccessToken,
  getAccessTokenVersion,
  setAccessToken,
} from "../../shared/api/index.ts";
import { parseAccessToken } from "../../shared/api/token-response.ts";
import type {
  ChangePasswordParams,
  ForgotPasswordParams,
  LoginParams,
  OtpRequestParams,
  OtpRequestProps,
  RegisterParams,
} from "./types.ts";

const basePath = "/auth";
let pendingLogout: { promise: Promise<void>; version: number } | undefined;

export const changePassword = async (
  params: ChangePasswordParams,
  signal?: AbortSignal,
): Promise<void> => {
  return apiClient.post<void>(`${basePath}/change-password`, params, {
    signal,
  });
};

export const forgotPassword = async (
  params: ForgotPasswordParams,
  signal?: AbortSignal,
): Promise<void> => {
  return apiClient.post<void>(`${basePath}/forgot-password`, params, {
    signal,
  });
};

export const login = async (
  params: LoginParams,
  signal?: AbortSignal,
): Promise<AccessTokenProps> => {
  const version = getAccessTokenVersion();
  const response = await apiClient.post<unknown>(`${basePath}/login`, params, {
    signal,
  });
  if (signal?.aborted || version !== getAccessTokenVersion()) {
    throw new CanceledError();
  }
  const result = parseAccessToken(response);
  setAccessToken(result.accessToken);
  return result;
};

export const logout = (): Promise<void> => {
  const version = getAccessTokenVersion();
  if (pendingLogout?.version === version) return pendingLogout.promise;

  const promise = apiClient
    .post<void>(`${basePath}/logout`)
    .then(() => undefined)
    .finally(() => {
      if (getAccessTokenVersion() === version) clearAccessToken();
      if (pendingLogout?.version === version) pendingLogout = undefined;
    });
  pendingLogout = { promise, version };
  return promise;
};

export const register = async (
  params: RegisterParams,
  signal?: AbortSignal,
): Promise<AccessTokenProps> => {
  const version = getAccessTokenVersion();
  const response = await apiClient.post<unknown>(
    `${basePath}/register`,
    params,
    { signal },
  );
  if (signal?.aborted || version !== getAccessTokenVersion()) {
    throw new CanceledError();
  }
  const result = parseAccessToken(response);
  setAccessToken(result.accessToken);
  return result;
};

export const requestOtp = async (
  params: OtpRequestParams,
  signal?: AbortSignal,
): Promise<OtpRequestProps> => {
  return apiClient.post<OtpRequestProps>(`${basePath}/otp-request`, params, {
    signal,
  });
};
