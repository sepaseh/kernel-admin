import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { i18n } from "@/shared/i18n";
import type * as SharedLib from "@/shared/lib";

const state = vi.hoisted(() => ({
  currentUser: undefined as CurrentUser | undefined,
  setCurrentRoute: vi.fn(),
  reportError: vi.fn(),
  usersImported: vi.fn(),
  usersRendered: vi.fn(),
  dashboardError: false,
}));

vi.mock("@/shared/lib", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedLib>()),
  reportError: state.reportError,
}));

vi.mock("@/app/hooks", () => ({
  useCore: () => ({ setCurrentRoute: state.setCurrentRoute }),
}));
vi.mock("@/layouts/auth", () => ({ AuthLayout: () => <Outlet /> }));
vi.mock("@/layouts/default", () => ({
  DefaultLayout: () => <Outlet context={{ currentUser: state.currentUser }} />,
}));
vi.mock("@/features/account", () => ({ AccountPage: () => "Account page" }));
vi.mock("@/features/login", () => ({ LoginPage: () => "Login page" }));
vi.mock("@/features/calendar", () => ({ CalendarPage: () => "Calendar page" }));
vi.mock("@/features/forgot-pass", () => ({
  ForgotPassPage: () => "Forgot password page",
}));
vi.mock("@/features/register", () => ({ RegisterPage: () => "Register page" }));
vi.mock("@/features/roles", () => ({ RolesPage: () => "Roles page" }));
vi.mock("@/features/settings", () => ({ SettingsPage: () => "Settings page" }));
vi.mock("@/features/files", () => ({ FilesPage: () => "Files page" }));
vi.mock("@/features/dashboard", () => ({
  DashboardPage: () => {
    if (state.dashboardError)
      throw new Error("Synthetic dashboard render failure");
    return "Dashboard page";
  },
}));

beforeEach(async () => {
  state.currentUser = {
    id: "user-1",
    firstName: "Ada",
    lastName: "Lovelace",
    mobile: "09120000000",
    status: "active",
    isSystemAdmin: true,
    permissions: [],
  };
  state.dashboardError = false;
  state.setCurrentRoute.mockClear();
  state.reportError.mockClear();
  state.usersImported.mockClear();
  state.usersRendered.mockClear();
  vi.doMock("@/features/users", () => {
    state.usersImported();
    return {
      UsersPage: () => {
        state.usersRendered();
        return "Users page";
      },
    };
  });
  vi.resetModules();
  // Prepare the real recovery UI before assertions. Routes must still load
  // after each test sets its initial browser URL.
  await import("@/shared/ui/error-boundary");
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("route composition", () => {
  it.each([
    ["/", "Dashboard page", "root"],
    ["/account", "Account page", "account"],
    ["/calendar", "Calendar page", "calendar"],
    ["/users", "Users page", "users"],
    ["/roles", "Roles page", "roles"],
    ["/settings", "Settings page", "settings"],
    ["/files", "Files page", "files"],
    ["/auth", "Login page", "auth"],
    ["/auth/forgot-password", "Forgot password page", "forgotPassword"],
    ["/auth/register", "Register page", "register"],
  ])(
    "renders the allowed route %s and reports the active route",
    async (path, content, route) => {
      window.history.replaceState({}, "", path);
      const { Routes } = await import("./Routes");
      render(<Routes />);
      expect(await screen.findByText(content)).toBeDefined();
      await waitFor(() =>
        expect(state.setCurrentRoute).toHaveBeenCalledWith(route),
      );
    },
  );

  it("redirects denied users routes before loading their feature module", async () => {
    state.currentUser = {
      ...state.currentUser!,
      isSystemAdmin: false,
      permissions: [],
    };
    window.history.replaceState({}, "", "/users");
    const { Routes } = await import("./Routes");
    render(<Routes />);
    await screen.findByText("Dashboard page");
    expect(state.usersImported).not.toHaveBeenCalled();
    expect(state.usersRendered).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
  });

  it("renders unknown paths with the standalone not-found page", async () => {
    window.history.replaceState({}, "", "/unknown-route");
    const { Routes } = await import("./Routes");
    render(<Routes />);
    expect(await screen.findByText("404")).toBeDefined();
    expect(state.setCurrentRoute).toHaveBeenCalledWith("notFound");
  });

  it("contains a failed feature render in the route recovery UI", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.dashboardError = true;
    window.history.replaceState({}, "", "/");
    const { Routes } = await import("./Routes");
    render(<Routes />);
    expect(await screen.findByText("500")).toBeDefined();
    expect(
      screen.getByRole("button", { name: i18n.t("reload") }),
    ).toBeDefined();
    await waitFor(() =>
      expect(state.reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Synthetic dashboard render failure",
        }),
        { source: "react-router.error-boundary" },
      ),
    );
  });
});
