import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../shared/api/index.ts";
import * as users from "./api.ts";

vi.mock("../../shared/api/index.ts", () => ({
  apiClient: {
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(apiClient.del).mockResolvedValue(undefined);
  vi.mocked(apiClient.get).mockResolvedValue(undefined);
  vi.mocked(apiClient.patch).mockResolvedValue(undefined);
  vi.mocked(apiClient.post).mockResolvedValue(undefined);
  vi.mocked(apiClient.put).mockResolvedValue(undefined);
});

describe("user API helper contracts", () => {
  it("maps create, read, update, and delete operations", async () => {
    const controller = new AbortController();
    await users.createUser(
      {
        firstName: "Ada",
        lastName: "Lovelace",
        mobile: "09120000000",
        password: "secret",
      },
      controller.signal,
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      "/users",
      {
        firstName: "Ada",
        lastName: "Lovelace",
        mobile: "09120000000",
        password: "secret",
      },
      { signal: controller.signal },
    );
    await users.fetchUser("user-1");
    expect(apiClient.get).toHaveBeenCalledWith("/users/user-1", {
      signal: undefined,
    });
    await users.updateUser(
      "user-1",
      {
        firstName: "Augusta",
        lastName: "Lovelace",
        mobile: "09120000000",
      },
      controller.signal,
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/users/user-1",
      {
        firstName: "Augusta",
        lastName: "Lovelace",
        mobile: "09120000000",
      },
      { signal: controller.signal },
    );
    await users.deleteUser("user-1", controller.signal);
    expect(apiClient.del).toHaveBeenCalledWith("/users/user-1", {
      signal: controller.signal,
    });
  });

  it("forwards the caller's AbortSignal for user detail and filtered list reads", async () => {
    const controller = new AbortController();
    await users.fetchUser("user-1", controller.signal);
    expect(apiClient.get).toHaveBeenLastCalledWith("/users/user-1", {
      signal: controller.signal,
    });
    await users.fetchUsers(
      { firstName: "Ada", offset: "0", size: "12" },
      controller.signal,
    );
    expect(apiClient.get).toHaveBeenLastCalledWith("/users", {
      params: { first_name: "Ada", offset: "0", size: "12" },
      signal: controller.signal,
    });
  });

  it.each([
    [users.updateUserPassword, "/password", { password: "secret" }],
    [users.updateUserRoles, "/roles", { roleIds: ["role-1"] }],
  ])("maps PUT subresource operation", async (operation, suffix, params) => {
    const controller = new AbortController();
    await operation("user-1", params as never, controller.signal);
    expect(apiClient.put).toHaveBeenCalledWith(
      `/users/user-1${suffix}`,
      params,
      { signal: controller.signal },
    );
  });

  it.each([
    [users.updateUserStatus, "/status", { status: "inactive" }],
    [users.updateUserSystemAdmin, "/system-admin", { isSystemAdmin: true }],
  ])("maps PATCH subresource operation", async (operation, suffix, params) => {
    const controller = new AbortController();
    await operation("user-1", params as never, controller.signal);
    expect(apiClient.patch).toHaveBeenCalledWith(
      `/users/user-1${suffix}`,
      params,
      { signal: controller.signal },
    );
  });
});
