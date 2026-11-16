import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";

import { deleteContent, fetchContents } from "./api";

const { del, get } = vi.hoisted(() => ({ del: vi.fn(), get: vi.fn() }));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: {
    del,
    get,
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
}));
beforeEach(() => {
  del.mockReset();
  get.mockReset();
});

it("keeps a content identifier inside one encoded URI segment", async () => {
  const { signal } = new AbortController();
  await deleteContent("a/b?c#d%20", signal);

  expect(del).toHaveBeenCalledWith("/contents/a%2Fb%3Fc%23d%2520", { signal });
});

it.each(["", ".", ".."])(
  "rejects an unsafe content identifier (%j) before sending a request",
  (id) => {
    expect(() => deleteContent(id)).toThrow();
    expect(del).not.toHaveBeenCalled();
  },
);

it("omits page size while preserving content filters and cancellation", async () => {
  const query = {
    page: "3",
    size: "1",
    title: "Guide",
    contentCategoryId: "category-2",
  };
  const { signal } = new AbortController();
  await fetchContents(query, signal);
  expect(get).toHaveBeenCalledExactlyOnceWith("/contents", {
    params: {
      page: "3",
      title: "Guide",
      content_category_id: "category-2",
    },
    signal,
  });
});
