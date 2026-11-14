import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { apiClient } from "@/shared/api";

import * as users from "./api";

vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof SharedApi>()),
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
});

describe("opaque user identifiers", () => {
  it.each(["", ".", ".."])(
    'rejects invalid identifier "%s" before reaching transport',
    async (id) => {
      const operations = [
        () => users.fetchUser(id),
        () => users.deleteUser(id),
        () =>
          users.updateUser(id, {
            firstName: "Ada",
            lastName: "Lovelace",
            mobile: "09120000000",
            status: "active",
          }),
        () => users.updateUserPassword(id, { password: "synthetic-password" }),
        () => users.updateUserRoles(id, { roleIds: ["role-1"] }),
        () => users.updateUserStatus(id, { status: "inactive" }),
        () => users.updateUserSystemAdmin(id, { isSystemAdmin: true }),
      ];
      for (const operation of operations)
        await expect(operation()).rejects.toThrow(TypeError);

      for (const method of Object.values(apiClient))
        expect(method).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["member/#? 1", "member%2F%23%3F%201"],
    ["عضو آبی", "%D8%B9%D8%B6%D9%88%20%D8%A2%D8%A8%DB%8C"],
    ["encoded%2Fid", "encoded%252Fid"],
  ])("keeps opaque ID %s inside the selected endpoint", async (id, segment) => {
    const controller = new AbortController();
    const profile = {
      firstName: "Ada",
      lastName: "Lovelace",
      mobile: "09120000000",
      status: "active",
    } as const;
    const path = `/users/${segment}`;

    await users.fetchUser(id, controller.signal);
    await users.updateUser(id, profile, controller.signal);
    await users.updateUserPassword(
      id,
      { password: "synthetic-password" },
      controller.signal,
    );
    await users.updateUserRoles(
      id,
      { roleIds: ["role/#? 1"] },
      controller.signal,
    );
    await users.updateUserStatus(id, { status: "inactive" }, controller.signal);
    await users.updateUserSystemAdmin(
      id,
      { isSystemAdmin: true },
      controller.signal,
    );
    await users.deleteUser(id, controller.signal);

    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith(path, {
      signal: controller.signal,
    });
    expect(apiClient.patch).toHaveBeenNthCalledWith(1, path, profile, {
      signal: controller.signal,
    });
    expect(apiClient.put).toHaveBeenNthCalledWith(
      1,
      `${path}/password`,
      {
        password: "synthetic-password",
      },
      { signal: controller.signal },
    );
    expect(apiClient.put).toHaveBeenNthCalledWith(
      2,
      `${path}/roles`,
      {
        roleIds: ["role/#? 1"],
      },
      { signal: controller.signal },
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      2,
      `${path}/status`,
      {
        status: "inactive",
      },
      { signal: controller.signal },
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      3,
      `${path}/system-admin`,
      {
        isSystemAdmin: true,
      },
      { signal: controller.signal },
    );
    expect(apiClient.del).toHaveBeenCalledExactlyOnceWith(path, {
      signal: controller.signal,
    });
  });
});
