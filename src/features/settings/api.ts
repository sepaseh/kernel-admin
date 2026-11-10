import { apiClient } from "@/shared/api";

import type { Settings, SettingsRequest } from "./types.ts";

const basePath = "/settings";

export const fetchSettings = (signal?: AbortSignal): Promise<Settings> =>
  apiClient.get<Settings>(basePath, { signal });

export const fetchLanguages = (
  signal?: AbortSignal,
): Promise<Settings["language"][]> =>
  apiClient.get<Settings["language"][]>("/languages", { signal });

export const updateSettings = (
  params: SettingsRequest,
  signal?: AbortSignal,
): Promise<Settings> => apiClient.put<Settings>(basePath, params, { signal });
