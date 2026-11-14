// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import type { FC, ReactNode } from "react";
import { Outlet } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/layouts/default", () => ({ DefaultLayout: () => <Outlet /> }));
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
vi.mock("@/features/register", () => ({
  RegisterPage: () => "Register page",
}));
vi.mock("@/features/roles", () => ({ RolesPage: () => "Roles page" }));
vi.mock("@/features/settings", () => ({
  SettingsPage: () => "Settings page",
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
    routeState.usersInitialized();
    if (routeState.usersLoadError) throw routeState.usersLoadError;
    return {
      UsersPage: () => {
        routeState.usersRendered();
        return "Users page";
      },
    };
  });
  vi.doUnmock("./Routes");
  vi.resetModules();
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
  ])("renders the allowed route %s", async (path, content, route) => {
    window.history.replaceState({}, "", path);
    const { Routes } = await import("./Routes");

    render(<Routes />);

    expect(await screen.findByText(content)).toBeInTheDocument();
    await waitFor(() => {
      expect(routeState.setCurrentRoute).toHaveBeenCalledWith(route);
    });
    if (route === "users") {
      expect(routeState.usersInitialized).toHaveBeenCalledTimes(1);
      expect(routeState.usersRendered).toHaveBeenCalled();
    }
  });

  it("redirects a disallowed route to the dashboard", async () => {
    routeState.allowedRoutes.delete("users");
    window.history.replaceState({}, "", "/users");
    const { Routes } = await import("./Routes");

    render(<Routes />);

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(routeState.usersRendered).not.toHaveBeenCalled();
    routeState.allowedRoutes.add("users");
  });

  it("redirects a denied route without importing its unavailable page module", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeState.allowedRoutes.delete("users");
    routeState.usersLoadError = new Error("synthetic unavailable users chunk");
    window.history.replaceState({}, "", "/users");
    try {
      const { Routes } = await import("./Routes");
      render(<Routes />);

      expect(await screen.findByText("Dashboard page")).toBeVisible();
      expect(routeState.usersInitialized).not.toHaveBeenCalled();
      expect(routeState.usersRendered).not.toHaveBeenCalled();
      expect(screen.queryByText("500")).not.toBeInTheDocument();
    } finally {
      routeState.allowedRoutes.add("users");
    }
  });

  it("reports a protected page import failure when the route is allowed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeState.usersLoadError = new Error("synthetic unavailable users chunk");
    window.history.replaceState({}, "", "/users");
    const { Routes } = await import("./Routes");
    const { setObservabilityTransport } = await import("@/shared/lib");
    const send = vi.fn();
    setObservabilityTransport(send);
    render(<Routes />);

    expect(await screen.findByText("500")).toBeVisible();
    expect(routeState.usersInitialized).toHaveBeenCalledTimes(1);
    expect(routeState.usersRendered).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          source: "react-router.error-boundary",
        }),
        name: "error",
      }),
    );
  });

  it("renders and reports the application fallback when a route module fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const send = vi.fn();
    routeState.loginLoadError = new Error("synthetic login module failure");
    window.history.replaceState({}, "", "/auth");
    const { Routes } = await import("./Routes");
    const { setObservabilityTransport } = await import("@/shared/lib");
    setObservabilityTransport(send);
    render(<Routes />);

    expect(await screen.findByText("500")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Reload|بارگذاری دوباره/ }),
    ).toBeVisible();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          source: "react-router.error-boundary",
        }),
        name: "error",
      }),
    );
  });

  it("renders and reports the application fallback when a route fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const send = vi.fn();
    routeState.dashboardError = true;
    window.history.replaceState({}, "", "/");
    const { Routes } = await import("./Routes");
    const { setObservabilityTransport } = await import("@/shared/lib");
    setObservabilityTransport(send);

    render(<Routes />);

    expect(await screen.findByText("500")).toBeVisible();
    expect(
      screen.getByText(/An unexpected error occurred|خطای غیرمنتظره‌ای رخ داد/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Reload|بارگذاری دوباره/ }),
    ).toBeVisible();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          source: "react-router.error-boundary",
        }),
        message: "dashboard failed",
        name: "error",
      }),
    );
  });
});
