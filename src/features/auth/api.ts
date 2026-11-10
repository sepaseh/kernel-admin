import { CanceledError } from "axios";

import {
  apiClient,
  getSessionSignal,
  parseAccessToken,
  setAccessToken,
} from "@/shared/api";

import type {
  ChangePasswordParams,
  ForgotPasswordParams,
  LoginParams,
  OtpRequestParams,
  OtpRequestProps,
  RegisterParams,
} from "./types";

export const logout = async (signal?: AbortSignal): Promise<void> => {
  await apiClient.post<void>("/auth/logout", undefined, { signal });
};

export const changePassword = async (
  params: ChangePasswordParams,
  signal?: AbortSignal,
): Promise<void> => {
  await apiClient.post<void>("/auth/change-password", params, { signal });
};

export const login = async (params: LoginParams, signal?: AbortSignal) => {
  const session = getSessionSignal();
  const response = await apiClient.post<unknown>("/auth/login", params, {
    signal,
  });
  if (signal?.aborted || session.aborted) throw new CanceledError();
  const result = parseAccessToken(response);
  setAccessToken(result.accessToken);
  return result;
};

export const register = async (
  params: RegisterParams,
  signal?: AbortSignal,
) => {
  const session = getSessionSignal();
  const response = await apiClient.post<unknown>("/auth/register", params, {
    signal,
  });
  if (signal?.aborted || session.aborted) throw new CanceledError();
  const result = parseAccessToken(response);
  setAccessToken(result.accessToken);
  return result;
};

export const forgotPassword = async (
  params: ForgotPasswordParams,
  signal?: AbortSignal,
): Promise<void> => {
  await apiClient.post<void>("/auth/forgot-password", params, { signal });
};
export const requestOtp = (
  params: OtpRequestParams,
  signal?: AbortSignal,
): Promise<OtpRequestProps> =>
  apiClient.post<OtpRequestProps>("/auth/otp-request", params, { signal });
