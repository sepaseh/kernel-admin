import {
  apiClient,
  encodeIdPathSegment,
  type UploadProgressHandler,
} from "@/shared/api";

import type { FileContext, StoredFile } from "./types";

export const deleteFile = (
  id: StoredFile["id"],
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.del<void>(`/files/${encodeIdPathSegment(id)}`, { signal });

export const fetchFiles = (signal?: AbortSignal): Promise<StoredFile[]> =>
  apiClient.get<StoredFile[]>("/files", { signal });

export const uploadFile = (
  file: File,
  context: FileContext,
  onUploadProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): Promise<StoredFile> =>
  apiClient.upload<StoredFile>(
    "/files",
    { context, file },
    { onUploadProgress, signal },
  );
