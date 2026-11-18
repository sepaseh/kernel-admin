import type { ContentCategory } from "@/features/content-categories";
import type { StoredFile } from "@/features/files";
import type { PaginationQuery } from "@/shared/api";

export type Content = {
  body: string;
  contentCategory: ContentCategory;
  coverImage: Pick<StoredFile, "id" | "url">;
  excerpt: string;
  id: string;
  title: string;
};
export type ContentRequest = Pick<Content, "title" | "body" | "excerpt"> & {
  contentCategoryId: ContentCategory["id"];
  coverImageId: StoredFile["id"];
};
export type ContentQuery = PaginationQuery &
  Partial<Pick<ContentRequest, "title" | "contentCategoryId">>;
