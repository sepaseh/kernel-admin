import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteRole } from "@/features/roles";
import { deleteUser } from "@/features/users";
import type * as SharedApi from "@/shared/api";

const { client } = vi.hoisted(() => ({
  client: {
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
}));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: client,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe.each([
  ["users", deleteUser],
  ["roles", deleteRole],
] as const)("opaque %s resource identifiers", (resource, remove) => {
  it("keeps slashes, queries and fragments inside one encoded path segment", async () => {
    const controller = new AbortController();
    await remove("a/b?c#d%20", controller.signal);

    expect(client.del).toHaveBeenCalledWith(`/${resource}/a%2Fb%3Fc%23d%2520`, {
      signal: controller.signal,
    });
  });

  it.each(["", ".", ".."])(
    "rejects an unsafe identifier (%j) before making a request",
    async (id) => {
      await expect(Promise.resolve().then(() => remove(id))).rejects.toThrow();
      expect(client.del).not.toHaveBeenCalled();
    },
  );
});
