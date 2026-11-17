import type { PaginationQuery } from "../api";

export const getPage = (page: PaginationQuery["page"]) =>
  Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
