import { apiClient } from "../../../../shared/api/index.ts";

const uploadTimeout = 60_000;

type FileResource = {
  contentType: string;
  id: string;
  url?: string;
  visibility: FileVisibility;
};

type FileVisibility = "private" | "public";

export const uploadFile = (
  file: File,
  visibility: FileVisibility,
): Promise<FileResource> => {
  const data = new FormData();
  data.append("file", file);
  data.append("visibility", visibility);

  return apiClient.post<FileResource>("/files", data, {
    timeout: uploadTimeout,
  });
};
