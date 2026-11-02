import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../shared/api/index.ts";
import { i18nInstance } from "../../shared/i18n/index.ts";
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
  describe.each([".", ".."])('URL dot segment "%s"', (id) => {
    it.each([
      ["read", (signal: AbortSignal) => users.fetchUser(id, signal)],
      ["delete", (signal: AbortSignal) => users.deleteUser(id, signal)],
      [
        "update",
        (signal: AbortSignal) =>
          users.updateUser(
            id,
            { firstName: "Ada", lastName: "Lovelace", mobile: "09120000000" },
            signal,
          ),
      ],
      [
        "password",
        (signal: AbortSignal) =>
          users.updateUserPassword(
            id,
            { password: "synthetic-password" },
            signal,
          ),
      ],
      [
        "roles",
        (signal: AbortSignal) =>
          users.updateUserRoles(id, { roleIds: ["role-1"] }, signal),
      ],
      [
        "status",
        (signal: AbortSignal) =>
          users.updateUserStatus(id, { status: "inactive" }, signal),
      ],
      [
        "system admin",
        (signal: AbortSignal) =>
          users.updateUserSystemAdmin(id, { isSystemAdmin: true }, signal),
      ],
    ] as const)(
      "rejects %s before any HTTP client call",
      async (_name, run) => {
        const controller = new AbortController();

        await expect(run(controller.signal)).rejects.toThrow(
          i18nInstance.t("unexpectedError"),
        );
        for (const method of Object.values(apiClient))
          expect(method).not.toHaveBeenCalled();
      },
    );
  });

  it.each([
    ["member/#? 1", "member%2F%23%3F%201"],
    ["عضو آبی", "%D8%B9%D8%B6%D9%88%20%D8%A2%D8%A8%DB%8C"],
    ["encoded%2Fid", "encoded%252Fid"],
  ])("keeps the opaque ID %s inside each user route", async (id, segment) => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const user = {
      firstName: "Ada",
      lastName: "Lovelace",
      mobile: "09120000000",
    };
    const password = { password: "synthetic-password" };
    const roles = { roleIds: ["role/#? 1"] };
    const status = { status: "inactive" } as const;
    const systemAdmin = { isSystemAdmin: true };
    const path = `/users/${segment}`;

    await users.fetchUser(id, controller.signal);
    expect(apiClient.get).toHaveBeenLastCalledWith(path, options);
    await users.deleteUser(id, controller.signal);
    expect(apiClient.del).toHaveBeenLastCalledWith(path, options);
    await users.updateUser(id, user, controller.signal);
    expect(apiClient.patch).toHaveBeenLastCalledWith(path, user, options);
    await users.updateUserPassword(id, password, controller.signal);
    expect(apiClient.put).toHaveBeenLastCalledWith(
      `${path}/password`,
      password,
      options,
    );
    await users.updateUserRoles(id, roles, controller.signal);
    expect(apiClient.put).toHaveBeenLastCalledWith(
      `${path}/roles`,
      roles,
      options,
    );
    await users.updateUserStatus(id, status, controller.signal);
    expect(apiClient.patch).toHaveBeenLastCalledWith(
      `${path}/status`,
      status,
      options,
    );
    await users.updateUserSystemAdmin(id, systemAdmin, controller.signal);
    expect(apiClient.patch).toHaveBeenLastCalledWith(
      `${path}/system-admin`,
      systemAdmin,
      options,
    );
  });

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
