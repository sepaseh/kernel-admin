import { apiClient, encodeIdPathSegment } from "@/shared/api";

import type { Faq, FaqRequest } from "./types";

const basePath = "/faqs";

export const fetchFaqs = (signal?: AbortSignal): Promise<Faq[]> =>
  apiClient.get<Faq[]>(basePath, { signal });

export const fetchFaq = (id: Faq["id"], signal?: AbortSignal): Promise<Faq> =>
  apiClient.get<Faq>(`${basePath}/${encodeIdPathSegment(id)}`, { signal });

export const createFaq = (
  params: FaqRequest,
  signal?: AbortSignal,
): Promise<Faq> => apiClient.post<Faq>(basePath, params, { signal });

export const updateFaq = (
  id: Faq["id"],
  params: FaqRequest,
  signal?: AbortSignal,
): Promise<Faq> =>
  apiClient.patch<Faq>(`${basePath}/${encodeIdPathSegment(id)}`, params, {
    signal,
  });

export const deleteFaq = (id: Faq["id"], signal?: AbortSignal): Promise<void> =>
  apiClient.del<void>(`${basePath}/${encodeIdPathSegment(id)}`, { signal });

export const sortFaqs = (
  params: { ids: Faq["id"][] },
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.patch<void>(`${basePath}/sort`, params, { signal });
