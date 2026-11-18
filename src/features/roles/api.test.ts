import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { apiClient } from "@/shared/api";

import {
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRole,
  fetchRoles,
  updateRole,
} from "./api";
import type { RoleRequest } from "./types";

vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("roles HTTP contract", () => {
  it("forwards one caller signal to list, detail and permissions reads", async () => {
    const controller = new AbortController();
    await fetchRoles(controller.signal);
    await fetchPermissions(controller.signal);
    await fetchRole("role/with?# spaces", controller.signal);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/roles", {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/roles/permissions", {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(
      3,
      "/roles/role%2Fwith%3F%23%20spaces",
      { signal: controller.signal },
    );
  });

  it("creates and updates permission arrays without changing their vocabulary", async () => {
    const controller = new AbortController();
    const request: RoleRequest = {
      name: "Operators",
      permissions: ["users.read", "roles.update"],
    };
    const response = { id: "role-1", ...request };
    vi.mocked(apiClient.post).mockResolvedValue(response);
    vi.mocked(apiClient.patch).mockResolvedValue(response);

    await expect(createRole(request, controller.signal)).resolves.toBe(
      response,
    );
    await expect(
      updateRole("role/1", request, controller.signal),
    ).resolves.toBe(response);
    expect(apiClient.post).toHaveBeenCalledWith("/roles", request, {
      signal: controller.signal,
    });
    expect(apiClient.patch).toHaveBeenCalledWith("/roles/role%2F1", request, {
      signal: controller.signal,
    });
  });

  it("encodes a deletion identifier and retains its failure for the confirmation", async () => {
    const controller = new AbortController();
    const error = new Error("Synthetic role still assigned");
    vi.mocked(apiClient.del).mockRejectedValue(error);

    await expect(deleteRole("role/1", controller.signal)).rejects.toBe(error);
    expect(apiClient.del).toHaveBeenCalledWith("/roles/role%2F1", {
      signal: controller.signal,
    });
  });
});
