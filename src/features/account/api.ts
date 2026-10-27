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
): Promise<OtpRequestProps> => {
  return apiClient.post<OtpRequestProps>(
    `${basePath}/request-email-verification`,
    params,
  );
};

export const updateProfile = async (
  params: UpdateProfileRequest,
): Promise<Account> => {
  return apiClient.patch<Account>(`${basePath}/update-profile`, params);
};

export const updateUsername = async (
  params: UpdateUsernameRequest,
): Promise<Account> => {
  return apiClient.post<Account>(`${basePath}/update-username`, params);
};

export const verifyEmail = async (
  params: VerifyEmailRequest,
): Promise<void> => {
  return apiClient.post<void>(`${basePath}/verify-email`, params);
};
