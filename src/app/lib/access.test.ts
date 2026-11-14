import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/features/account";

import {
  getAllowedNavigation,
  getRoutePermissions,
  hasRouteAccess,
} from "./access";

const user: CurrentUser = {
  id: "synthetic-user",
  firstName: "Test",
  lastName: "User",
  mobile: "09120000000",
  isSystemAdmin: false,
  permissions: [],
  status: "active",
};

describe("route and action access", () => {
  it("allows public screens and denies protected screens to an anonymous visitor", () => {
    expect(hasRouteAccess("auth")).toBe(true);
    expect(hasRouteAccess("register")).toBe(true);
    expect(hasRouteAccess("root")).toBe(false);
    expect(hasRouteAccess("users")).toBe(false);
    expect(getAllowedNavigation()).toEqual([]);
  });

  it("allows authenticated-only routes without granting administrative access", () => {
    expect(hasRouteAccess("account", user)).toBe(true);
    expect(hasRouteAccess("root", user)).toBe(true);
    expect(hasRouteAccess("users", user)).toBe(false);
    expect(getRoutePermissions("users", user)).toEqual({
      canCreate: false,
      canDelete: false,
      canUpdate: false,
    });
  });

  it("checks page and mutation permissions independently", () => {
    const reader = {
      ...user,
      permissions: ["users.read", "users.update"],
    } satisfies CurrentUser;

    expect(hasRouteAccess("users", reader)).toBe(true);
    expect(hasRouteAccess("roles", reader)).toBe(false);
    expect(getRoutePermissions("users", reader)).toEqual({
      canCreate: false,
      canDelete: false,
      canUpdate: true,
    });
    expect(getAllowedNavigation(reader)).toEqual([
      { route: "root" },
      {
        key: "userManagement",
        label: "userManagement",
        children: [{ route: "users" }],
      },
    ]);
  });

  it("grants system administrators access without requiring explicit permission entries", () => {
    const administrator = { ...user, isSystemAdmin: true };

    expect(hasRouteAccess("settings", administrator)).toBe(true);
    expect(getRoutePermissions("roles", administrator)).toEqual({
      canCreate: true,
      canDelete: true,
      canUpdate: true,
    });
    expect(getAllowedNavigation(administrator).length).toBeGreaterThan(1);
  });
});
