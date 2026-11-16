import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";

import { deleteContentCategory } from "./api";

const { del } = vi.hoisted(() => ({ del: vi.fn() }));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: {
    del,
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
}));
beforeEach(() => {
  del.mockReset();
});

it("keeps a category identifier inside one encoded URI segment", async () => {
  const { signal } = new AbortController();
  await deleteContentCategory("a/b?c#d%20", signal);

  expect(del).toHaveBeenCalledWith("/content-categories/a%2Fb%3Fc%23d%2520", {
    signal,
  });
});

it.each(["", ".", ".."])(
  "rejects an unsafe category identifier (%j) before sending a request",
  (id) => {
    expect(() => deleteContentCategory(id)).toThrow();
    expect(del).not.toHaveBeenCalled();
  },
);
