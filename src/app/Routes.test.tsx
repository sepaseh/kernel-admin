// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FC, ReactNode } from "react";
import { Outlet } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  allowedRoutes: new Set([
    "account",
    "auth",
    "calendar",
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
  feedbackInitialized: vi.fn(),
  routesInitialized: vi.fn(),
  authInitialized: vi.fn(),
  loginInitialized: vi.fn(),
  authModuleReady: undefined as Promise<void> | undefined,
  loginModuleReady: undefined as Promise<void> | undefined,
  loginLoadError: null as Error | null,
  usersRendered: vi.fn(),
  dashboardError: false,
  retrySettings: vi.fn(),
  settingsError: null as Error | null,
  settingsLoading: false,
  settingsReady: true,
  setCurrentRoute: vi.fn(),
}));

vi.mock("@/app/hooks/useCore", () => ({
  useCore: () => ({
    retrySettings: routeState.retrySettings,
    setCurrentRoute: routeState.setCurrentRoute,
    settingsError: routeState.settingsError,
    settingsLoading: routeState.settingsLoading,
    themePalettes: routeState.settingsReady ? {} : undefined,
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
vi.mock("@/app/providers/core/SettingsFeedback", async (importOriginal) => {
  routeState.feedbackInitialized();
  return importOriginal<
    typeof import("@/app/providers/core/SettingsFeedback")
  >();
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
vi.mock("@/features/users", () => ({
  UsersPage: () => {
    routeState.usersRendered();
    return "Users page";
  },
}));

beforeEach(() => {
  routeState.antdMount.mockClear();
  routeState.antdUnmount.mockClear();
  routeState.appearanceInitialized.mockClear();
  routeState.feedbackInitialized.mockClear();
  routeState.routesInitialized.mockClear();
  routeState.authInitialized.mockClear();
  routeState.loginInitialized.mockClear();
  routeState.authModuleReady = undefined;
  routeState.loginModuleReady = undefined;
  routeState.loginLoadError = null;
  routeState.usersRendered.mockClear();
  routeState.dashboardError = false;
  routeState.retrySettings.mockClear();
  routeState.settingsError = null;
  routeState.settingsLoading = false;
  routeState.settingsReady = true;
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
  vi.doUnmock("./Routes");
  vi.resetModules();
});

describe("application routes", () => {
  it("waits for initial settings and keeps bootstrap failure retryable before mounting routes", async () => {
    vi.doMock("./Routes", () => {
      routeState.routesInitialized();
      return { Routes: () => <output>Verified application routes</output> };
    });
    const user = userEvent.setup();
    routeState.settingsReady = false;
    routeState.settingsLoading = true;
    window.history.replaceState({}, "", "/auth");
    const { App } = await import("./App");
    const { rerender } = render(<App />);
    const bootstrapStatus = screen.getByLabelText(/Loading|در حال بارگذاری/);
    expect(bootstrapStatus).toBeVisible();
    expect(bootstrapStatus).toHaveTextContent(/Loading|در حال بارگذاری/);
    expect(routeState.antdMount).not.toHaveBeenCalled();
    expect(routeState.appearanceInitialized).not.toHaveBeenCalled();
    expect(routeState.feedbackInitialized).not.toHaveBeenCalled();
    expect(routeState.routesInitialized).not.toHaveBeenCalled();
    expect(screen.queryByTestId("antd-provider")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Verified application routes"),
    ).not.toBeInTheDocument();

    routeState.settingsLoading = false;
    routeState.settingsError = new Error("synthetic initial settings failure");
    rerender(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "synthetic initial settings failure",
    );
    const retryProvider = screen.getByTestId("antd-provider");
    expect(routeState.antdMount).toHaveBeenCalledTimes(1);
    expect(routeState.appearanceInitialized).toHaveBeenCalledTimes(1);
    expect(routeState.feedbackInitialized).toHaveBeenCalledTimes(1);
    expect(routeState.routesInitialized).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /Retry|تلاش دوباره/ }));
    expect(routeState.retrySettings).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("antd-provider")).toBe(retryProvider);
    expect(routeState.setCurrentRoute).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Verified application routes"),
    ).not.toBeInTheDocument();

    routeState.settingsReady = true;
    routeState.settingsError = null;
    rerender(<App />);
    expect(
      await screen.findByText("Verified application routes"),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("antd-provider")).toBe(retryProvider);
    expect(routeState.antdMount).toHaveBeenCalledTimes(1);
    expect(routeState.antdUnmount).not.toHaveBeenCalled();
  }, 30_000);

  it("retains the verified route while a later settings refresh fails", async () => {
    vi.doMock("./Routes", () => ({
      Routes: () => <output>Verified application routes</output>,
    }));
    window.history.replaceState({}, "", "/auth");
    const { App } = await import("./App");
    const { rerender } = render(<App />);
    const verifiedRoute = await screen.findByText(
      "Verified application routes",
    );
    expect(verifiedRoute).toBeVisible();
    const verifiedProvider = screen.getByTestId("antd-provider");
    expect(routeState.antdMount).toHaveBeenCalledTimes(1);

    routeState.settingsError = new Error("synthetic settings refresh failure");
    rerender(<App />);
    expect(screen.getByText("Verified application routes")).toBe(verifiedRoute);
    expect(verifiedRoute).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "synthetic settings refresh failure",
    );
    expect(screen.getByTestId("antd-provider")).toBe(verifiedProvider);
    expect(routeState.antdMount).toHaveBeenCalledTimes(1);
    expect(routeState.antdUnmount).not.toHaveBeenCalled();
  }, 30_000);

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
    ["/auth", "Login page", "auth"],
    ["/auth/forgot-password", "Forgot password page", "forgotPassword"],
    ["/auth/register", "Register page", "register"],
  ])("renders the allowed route %s", async (path, content, route) => {
    window.history.replaceState({}, "", path);
    const { Routes } = await import("./Routes");

    render(<Routes />);

    expect(await screen.findByText(content)).toBeInTheDocument();
    expect(routeState.setCurrentRoute).toHaveBeenCalledWith(route);
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
