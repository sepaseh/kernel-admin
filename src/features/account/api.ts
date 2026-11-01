import { apiClient } from "../../shared/api/index.ts";
import type { OtpRequestProps } from "../auth/types.ts";
import type {
  Account,
  EmailVerificationRequest,
  UpdateProfileRequest,
  UpdateUsernameRequest,
  VerifyEmailRequest,
} from "./types.ts";

const basePath = "/account";

export const getAccount = async (signal?: AbortSignal): Promise<Account> => {
  return apiClient.get<Account>(`${basePath}/me`, { signal });
};

export const requestEmailVerification = async (
  params: EmailVerificationRequest,
  signal?: AbortSignal,
): Promise<OtpRequestProps> => {
  return apiClient.post<OtpRequestProps>(
    `${basePath}/request-email-verification`,
    params,
    { signal },
  );
};

export const updateProfile = async (
  params: UpdateProfileRequest,
  signal?: AbortSignal,
): Promise<Account> => {
  return apiClient.patch<Account>(`${basePath}/update-profile`, params, {
    signal,
  });
};

export const updateUsername = async (
  params: UpdateUsernameRequest,
  signal?: AbortSignal,
): Promise<Account> => {
  return apiClient.post<Account>(`${basePath}/update-username`, params, {
    signal,
  });
};

export const verifyEmail = async (
  params: VerifyEmailRequest,
  signal?: AbortSignal,
): Promise<void> => {
  return apiClient.post<void>(`${basePath}/verify-email`, params, { signal });
};
