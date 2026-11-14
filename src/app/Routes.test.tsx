// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import type { FC, ReactNode } from "react";
import { Outlet } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  allowedRoutes: new Set([
    "account",
    "auth",
    "calendar",
    "files",
    "forgotPassword",
    "notFound",
    "register",
    "roles",
    "root",
    "settings",
    "users",
  ]),
  antdMount: vi.fn(),
  antdUnmount: vi.fn(),
  appearanceInitialized: vi.fn(),
  routesInitialized: vi.fn(),
  authInitialized: vi.fn(),
  loginInitialized: vi.fn(),
  authModuleReady: undefined as Promise<void> | undefined,
  loginModuleReady: undefined as Promise<void> | undefined,
  loginLoadError: null as Error | null,
  usersInitialized: vi.fn(),
  usersLoadError: null as Error | null,
  usersRendered: vi.fn(),
  dashboardError: false,
  setCurrentRoute: vi.fn(),
}));

vi.mock("@/app/hooks/useCore", () => ({
  useCore: () => ({
    setCurrentRoute: routeState.setCurrentRoute,
    user: {},
  }),
}));
vi.mock("@/app/providers/core/Core", async () => {
  const { Fragment } = await import("react");
  await import("@/shared/i18n");
  return { CoreProvider: Fragment };
});
vi.mock("@/app/providers/antd/Antd", async () => {
  const { useEffect } = await import("react");
  routeState.appearanceInitialized();
  type MockProviderProps = { children?: ReactNode };
  const AntdProvider: FC<MockProviderProps> = ({ children }) => {
    useEffect(() => {
      routeState.antdMount();
      return () => routeState.antdUnmount();
    }, []);
    return <div data-testid="antd-provider">{children}</div>;
  };
  return { AntdProvider };
});
vi.mock("@/app/lib", () => ({
  hasRouteAccess: (route: string) => routeState.allowedRoutes.has(route),
}));
vi.mock("@/features/account", () => ({ AccountPage: () => "Account page" }));
vi.mock("@/features/dashboard", () => ({
  DashboardPage: () => {
    if (routeState.dashboardError) throw new Error("dashboard failed");
    return "Dashboard page";
  },
}));
vi.mock("@/features/calendar", () => ({
  CalendarPage: () => "Calendar page",
}));
vi.mock("@/features/files", () => ({ FilesPage: () => "Files page" }));
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

beforeEach(() => {
  routeState.antdMount.mockClear();
  routeState.antdUnmount.mockClear();
  routeState.appearanceInitialized.mockClear();
  routeState.routesInitialized.mockClear();
  routeState.authInitialized.mockClear();
  routeState.loginInitialized.mockClear();
  routeState.authModuleReady = undefined;
  routeState.loginModuleReady = undefined;
  routeState.loginLoadError = null;
  routeState.usersInitialized.mockClear();
  routeState.usersLoadError = null;
  routeState.usersRendered.mockClear();
  routeState.dashboardError = false;
  routeState.setCurrentRoute.mockClear();
  vi.doMock("@/layouts/auth", async () => {
    routeState.authInitialized();
    await routeState.authModuleReady;
    return { AuthLayout: () => <Outlet /> };
  });
  vi.doMock("@/features/login", async () => {
    routeState.loginInitialized();
    await routeState.loginModuleReady;
    if (routeState.loginLoadError) throw routeState.loginLoadError;
    return { LoginPage: () => "Login page" };
  });
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

describe("application routes", () => {
  it("renders the not-found page for an unknown route", async () => {
    window.history.replaceState({}, "", "/unknown-route");
    const { Routes } = await import("./Routes");

    render(<Routes />);

    expect(await screen.findByText("404")).toBeInTheDocument();
  }, 30_000);

  it("loads the matched layout and page together while retaining its mounted provider", async () => {
    let finishAuth = () => {};
    let finishLogin = () => {};
    routeState.authModuleReady = new Promise<void>((resolve) => {
      finishAuth = resolve;
    });
    routeState.loginModuleReady = new Promise<void>((resolve) => {
      finishLogin = resolve;
    });
    window.history.replaceState({}, "", "/auth");
    const { App } = await import("./App");
    render(<App />);

    try {
      await waitFor(() => {
        expect(routeState.authInitialized).toHaveBeenCalledTimes(1);
        expect(routeState.loginInitialized).toHaveBeenCalledTimes(1);
      });
      const provider = await screen.findByTestId("antd-provider");
      expect(screen.getByLabelText(/Loading|در حال بارگذاری/)).toBeVisible();
      expect(screen.queryByText("Login page")).not.toBeInTheDocument();
      await act(async () => finishAuth());
      expect(screen.getByTestId("antd-provider")).toBe(provider);
      expect(screen.queryByText("Login page")).not.toBeInTheDocument();
      await act(async () => finishLogin());
      expect(await screen.findByText("Login page")).toBeVisible();
      expect(screen.getByTestId("antd-provider")).toBe(provider);
      expect(routeState.antdMount).toHaveBeenCalledTimes(1);
      expect(routeState.antdUnmount).not.toHaveBeenCalled();
    } finally {
      finishAuth();
      finishLogin();
    }
  });

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
