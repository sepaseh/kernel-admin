import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";

import { fetchUsers, updateUserRoles, updateUserSystemAdmin } from "./api";

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

describe("users HTTP contract", () => {
  it("uses the default page and fixed size without converting page into an offset", async () => {
    client.get.mockResolvedValue({ items: [], total: 0 });

    await fetchUsers();

    expect(client.get).toHaveBeenCalledWith("/users", {
      params: { page: "1", size: "24" },
      signal: undefined,
    });
  });

  it("preserves filters and cancellation while converting parameter keys", async () => {
    const controller = new AbortController();
    client.get.mockResolvedValue({ items: [], total: 0 });

    await fetchUsers(
      { page: "3", firstName: "Test", status: "active" },
      controller.signal,
    );

    expect(client.get).toHaveBeenCalledWith("/users", {
      params: { page: "3", size: "24", first_name: "Test", status: "active" },
      signal: controller.signal,
    });
  });

  it("keeps the fixed page size when URL parameters contain a different size", async () => {
    const query = Object.fromEntries(new URLSearchParams("page=2&size=12"));
    client.get.mockResolvedValue({ items: [], total: 0 });

    await fetchUsers(query);

    expect(client.get).toHaveBeenCalledWith("/users", {
      params: { page: "2", size: "24" },
      signal: undefined,
    });
  });

  it("sends role and system-administrator writes through their distinct endpoints", async () => {
    const controller = new AbortController();
    await updateUserRoles(
      "synthetic-user",
      { roleIds: ["synthetic-role"] },
      controller.signal,
    );
    await updateUserSystemAdmin(
      "synthetic-user",
      { isSystemAdmin: true },
      controller.signal,
    );

    expect(client.put).toHaveBeenCalledWith(
      "/users/synthetic-user/roles",
      { roleIds: ["synthetic-role"] },
      { signal: controller.signal },
    );
    expect(client.patch).toHaveBeenCalledWith(
      "/users/synthetic-user/system-admin",
      { isSystemAdmin: true },
      { signal: controller.signal },
    );
  });
});
