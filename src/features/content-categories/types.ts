export type ContentCategory = {
  id: string;
  name: string;
};

export type ContentCategoryRequest = Pick<ContentCategory, "name">;
