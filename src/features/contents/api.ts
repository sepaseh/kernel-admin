import { apiClient, encodeIdPathSegment } from "@/shared/api";
import { defaultPageSize } from "@/shared/config";
import { toSnakeCase } from "@/shared/lib";

import type { Content, ContentQuery, ContentRequest } from "./types";

const basePath = "/contents";
export const fetchContents = (
  {
    page = "1",
    size = String(defaultPageSize),
    title,
    contentCategoryId,
  }: ContentQuery = {},
  signal?: AbortSignal,
): Promise<{ items: Content[]; total: number }> =>
  apiClient.get<{ items: Content[]; total: number }>(basePath, {
    params: toSnakeCase({ page, size, title, contentCategoryId }),
    signal,
  });
export const fetchContent = (
  id: Content["id"],
  signal?: AbortSignal,
): Promise<Content> =>
  apiClient.get<Content>(`${basePath}/${encodeIdPathSegment(id)}`, { signal });
export const createContent = (
  params: ContentRequest,
  signal?: AbortSignal,
): Promise<Content> => apiClient.post<Content>(basePath, params, { signal });
export const updateContent = (
  id: Content["id"],
  params: ContentRequest,
  signal?: AbortSignal,
): Promise<Content> =>
  apiClient.patch<Content>(`${basePath}/${encodeIdPathSegment(id)}`, params, {
    signal,
  });
export const deleteContent = (
  id: Content["id"],
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.del<void>(`${basePath}/${encodeIdPathSegment(id)}`, { signal });
