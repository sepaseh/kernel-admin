import { apiClient, encodeIdPathSegment } from "@/shared/api";

import type { ContentCategory, ContentCategoryRequest } from "./types";

const basePath = "/content-categories";

export const fetchContentCategories = (
  signal?: AbortSignal,
): Promise<ContentCategory[]> =>
  apiClient.get<ContentCategory[]>(basePath, { signal });

export const fetchContentCategory = (
  id: ContentCategory["id"],
  signal?: AbortSignal,
): Promise<ContentCategory> =>
  apiClient.get<ContentCategory>(`${basePath}/${encodeIdPathSegment(id)}`, {
    signal,
  });

export const createContentCategory = (
  params: ContentCategoryRequest,
  signal?: AbortSignal,
): Promise<ContentCategory> =>
  apiClient.post<ContentCategory>(basePath, params, { signal });

export const updateContentCategory = (
  id: ContentCategory["id"],
  params: ContentCategoryRequest,
  signal?: AbortSignal,
): Promise<ContentCategory> =>
  apiClient.patch<ContentCategory>(
    `${basePath}/${encodeIdPathSegment(id)}`,
    params,
    { signal },
  );

export const deleteContentCategory = (
  id: ContentCategory["id"],
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.del<void>(`${basePath}/${encodeIdPathSegment(id)}`, { signal });

export const sortContentCategories = (
  params: { ids: ContentCategory["id"][] },
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.patch<void>(`${basePath}/sort`, params, { signal });
