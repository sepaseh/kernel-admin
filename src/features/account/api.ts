import { apiClient } from "@/shared/api";

import type { CurrentUser, ProfileRequest } from "./types";

export const fetchCurrentUser = async (
  signal?: AbortSignal,
): Promise<CurrentUser> => {
  return apiClient.get<CurrentUser>("/account/me", { signal });
};

export const updateProfile = async (
  params: ProfileRequest,
  signal?: AbortSignal,
): Promise<CurrentUser> => {
  return apiClient.patch<CurrentUser>("/account/update-profile", params, {
    signal,
  });
};
