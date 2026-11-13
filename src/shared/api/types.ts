import type { AxiosRequestConfig } from "axios";

export type AccessTokenProps = {
  accessToken: string;
};

export type PaginationQuery = {
  page?: string;
  size?: string;
};

export type UploadProgressHandler = NonNullable<
  AxiosRequestConfig["onUploadProgress"]
>;
