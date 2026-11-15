import type { AxiosRequestConfig } from "axios";

export type AccessTokenProps = {
  accessToken: string;
};

export type UploadProgressHandler = NonNullable<
  AxiosRequestConfig["onUploadProgress"]
>;

export type PaginationQuery = { page?: string };
