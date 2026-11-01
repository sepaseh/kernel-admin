import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../shared/api/index.ts";
import {
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRole,
  fetchRoles,
  updateRole,
} from "./api.ts";
import type { RoleRequest } from "./types.ts";

vi.mock("../../shared/api/index.ts", () => ({
  apiClient: {
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(apiClient.del).mockResolvedValue(undefined);
  vi.mocked(apiClient.get).mockResolvedValue([]);
  vi.mocked(apiClient.patch).mockResolvedValue({});
  vi.mocked(apiClient.post).mockResolvedValue({});
});

describe("roles API", () => {
  it("creates, updates, and deletes roles", async () => {
    const controller = new AbortController();
    const params = {
      name: "Operators",
      permissions: ["users.read"],
    } satisfies RoleRequest;

    await createRole(params, controller.signal);
    await updateRole("role-1", params, controller.signal);
    await deleteRole("role-1", controller.signal);

    expect(apiClient.post).toHaveBeenCalledWith("/roles", params, {
      signal: controller.signal,
    });
    expect(apiClient.patch).toHaveBeenCalledWith("/roles/role-1", params, {
      signal: controller.signal,
    });
    expect(apiClient.del).toHaveBeenCalledWith("/roles/role-1", {
      signal: controller.signal,
    });
  });

  it("loads role collections, details, and permissions", async () => {
    const controller = new AbortController();
    await fetchRoles(controller.signal);
    await fetchRole("role-1", controller.signal);
    await fetchPermissions(controller.signal);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/roles", {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/roles/role-1", {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(3, "/roles/permissions", {
      signal: controller.signal,
    });
  });
});
