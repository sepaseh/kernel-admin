import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";

vi.mock("../../shared/i18n/index.ts", () => {
  const i18n = { t: (key: string) => key };
  return { i18n, i18nInstance: i18n };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("users HTTP contract", () => {
  it("uses page/size defaults without converting page into an offset", async () => {
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
      { page: "3", size: "12", firstName: "Test", status: "active" },
      controller.signal,
    );

    expect(client.get).toHaveBeenCalledWith("/users", {
      params: { page: "3", size: "12", first_name: "Test", status: "active" },
      signal: controller.signal,
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
