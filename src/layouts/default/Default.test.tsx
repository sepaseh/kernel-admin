// @vitest-environment jsdom
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import type * as ReactI18next from "react-i18next";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCurrentUser } from "@/features/account";
import type { CurrentUser } from "@/features/account/types";
import { logout } from "@/features/auth";
import type * as SharedApi from "@/shared/api";
import {
  AdminApiError,
  clearAccessToken,
  setUnauthorizedHandler,
  setAccessToken,
} from "@/shared/api";
import { render, screen } from "@/test/render";
import { deferred } from "@/test/deferred";

import { DefaultLayout } from "./Default";
import type { DefaultLayoutContext } from "./types";

const mocks = vi.hoisted(() => {
  const account: CurrentUser = {
    firstName: "Ada",
    id: "user-1",
    isSystemAdmin: false,
    lastName: "Lovelace",
    mobile: "09120000000",
    permissions: ["users.read"],
    status: "active",
  };

  return {
    account,
    messages: { error: vi.fn() },
    reloadFinished: vi.fn(),
    core: {
      compact: false,
      currentRoute: "root",
      settings: {
        darkLogo: { url: "/dark-logo.svg" },
        lightLogo: { url: "/light-logo.svg" },
        language: { direction: "ltr" },
      },
      setCompact: vi.fn(),
      setTheme: vi.fn(),
      theme: "light",
    },
  };
});

vi.mock("@/features/account", () => ({
  fetchCurrentUser: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("@/shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    clearAccessToken: vi.fn(
      (...args: Parameters<typeof SharedApi.clearAccessToken>) =>
        actual.clearAccessToken(...args),
    ),
    setUnauthorizedHandler: vi.fn(),
  };
});

vi.mock("@/app/hooks", () => ({
  useCore: () => mocks.core,
  useAntd: () => ({
    messageAPI: mocks.messages,
    token: {
      colorBgLayout: "#f5f5f5",
      marginMD: 16,
      paddingMD: 16,
      paddingSM: 8,
      paddingXS: 4,
      size: 16,
      screenXXXL: 1920,
    },
  }),
}));

vi.mock("@/app/lib", () => ({
  getAllowedNavigation: () => [
    { route: "root" },
    {
      children: [{ route: "users" }, { route: "roles" }],
      key: "userManagement",
      label: "userManagement",
    },
  ],
}));

vi.mock("antd-style", () => ({
  useResponsive: () => ({ lg: false }),
  useAntdToken: () => ({
    colorBgContainer: "#ffffff",
    colorBgLayout: "#f5f5f5",
    colorTextBase: "#222222",
    marginMD: 16,
    paddingMD: 16,
    paddingSM: 8,
    screenXXXL: 1920,
  }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactI18next>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const Location = () => {
  const location = useLocation();
  return <output aria-label="location">{location.pathname}</output>;
};

const AccountPage = () => {
  const navigate = useNavigate();
  return (
    <button onClick={() => void navigate(-1)} type="button">
      Back
    </button>
  );
};

const ContextConsumer = () => {
  const { clearSession, currentUser, fetchCurrentUser } =
    useOutletContext<DefaultLayoutContext>();

  return (
    <>
      <input aria-label="Unsaved child content" defaultValue="Draft" />
      <output aria-label="account identity">
        {currentUser.id}/{currentUser.lastName}
      </output>
      <button
        onClick={async () => {
          await fetchCurrentUser();
          mocks.reloadFinished();
        }}
        type="button"
      >
        Refresh account
      </button>
      <button onClick={clearSession} type="button">
        Clear session
      </button>
    </>
  );
};

const renderLayout = (content = <h1>Dashboard content</h1>) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Location />
      <Routes>
        <Route element={<DefaultLayout />} path="/">
          <Route index element={content} />
          <Route element={<AccountPage />} path="account" />
          <Route element={<h1>Users content</h1>} path="users" />
        </Route>
        <Route element={<h1>Authentication</h1>} path="/auth" />
      </Routes>
    </MemoryRouter>,
  );

const renderLoadedLayout = async () => {
  const value = renderLayout();
  await screen.findByRole("heading", { name: "Dashboard content" });
  return value;
};

let navigationRouter: ReturnType<typeof createMemoryRouter> | undefined;
afterEach(() => {
  navigationRouter?.dispose();
  navigationRouter = undefined;
});

beforeEach(() => {
  setAccessToken("synthetic-layout-token");
  mocks.core.compact = false;
  mocks.core.currentRoute = "root";
  mocks.core.theme = "light";
  vi.mocked(fetchCurrentUser).mockResolvedValue(mocks.account);
  vi.mocked(logout).mockResolvedValue(undefined);
});

describe("DefaultLayout", () => {
  it("exposes the accepted account, awaited reload and session cleanup to its children", async () => {
    const response = deferred<CurrentUser>();
    const updated = { ...mocks.account, lastName: "Updated" };
    vi.mocked(fetchCurrentUser)
      .mockResolvedValueOnce(mocks.account)
      .mockReturnValueOnce(response.promise);
    const { user } = renderLayout(<ContextConsumer />);

    expect(await screen.findByLabelText("account identity")).toHaveTextContent(
      mocks.account.id,
    );
    await user.click(screen.getByRole("button", { name: "Refresh account" }));
    expect(fetchCurrentUser).toHaveBeenCalledTimes(2);
    expect(mocks.reloadFinished).not.toHaveBeenCalled();

    response.resolve(updated);
    await waitFor(() =>
      expect(screen.getByLabelText("account identity")).toHaveTextContent(
        "Updated",
      ),
    );
    await waitFor(() => expect(mocks.reloadFinished).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: "Clear session" }));
    expect(clearAccessToken).toHaveBeenCalledOnce();
    await screen.findByRole("heading", { name: "Authentication" });
  });

  it.each(["pointer", "keyboard"])(
    "closes the mobile drawer after %s navigation without remounting the layout",
    async (interaction) => {
      navigationRouter = createMemoryRouter([
        {
          path: "/",
          element: <DefaultLayout />,
          children: [
            { index: true, element: <h1>Dashboard content</h1> },
            { path: "users", element: <h1>Users content</h1> },
          ],
        },
      ]);
      const { user } = render(<RouterProvider router={navigationRouter} />);
      await screen.findByRole("heading", { name: "Dashboard content" });
      await user.click(screen.getByRole("button", { name: "menu" }));
      const drawer = await screen.findByRole("dialog");
      await user.click(within(drawer).getByText("userManagement"));
      const link = within(drawer).getByRole("link", { name: "users" });

      if (interaction === "keyboard") {
        link.focus();
        await user.keyboard("{Enter}");
      } else {
        await user.click(link);
      }

      expect(
        await screen.findByRole("heading", { name: "Users content" }),
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(fetchCurrentUser).toHaveBeenCalledOnce();
    },
  );

  it("closes the mobile drawer when selecting the current route", async () => {
    const { user } = await renderLoadedLayout();
    await user.click(screen.getByRole("button", { name: "menu" }));
    const drawer = await screen.findByRole("dialog");

    await user.click(within(drawer).getByRole("link", { name: "dashboard" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Dashboard content" }),
    ).toBeVisible();
    expect(fetchCurrentUser).toHaveBeenCalledOnce();
  });

  it("constrains the header and page content to the shared container", async () => {
    const { container } = await renderLoadedLayout();
    const headerContent = container.querySelector("header")?.firstElementChild;
    const main = container.querySelector("main");

    expect(headerContent).toHaveStyle({
      marginInline: "auto",
      maxWidth: "1920px",
    });
    expect(main).toHaveStyle({
      backgroundColor: "#f5f5f5",
      marginInline: "auto",
      maxWidth: "1920px",
    });
  });

  it("shows the active page hierarchy in a breadcrumb", async () => {
    mocks.core.currentRoute = "users";

    await renderLoadedLayout();

    const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(breadcrumb).toHaveTextContent("dashboard/userManagement/users");
    expect(
      within(breadcrumb).getByRole("link", { name: "dashboard" }),
    ).toHaveAttribute("href", "/");
  });

  it("loads the account, registers session handling, and logs out", async () => {
    const { unmount, user } = await renderLoadedLayout();

    expect(
      screen.getByRole("heading", { name: "Dashboard content" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "logo" })).toBeVisible();
    expect(screen.getByRole("img", { name: "logo" })).toHaveAttribute(
      "src",
      "/light-logo.svg",
    );
    await waitFor(() => expect(fetchCurrentUser).toHaveBeenCalledOnce());
    expect(setUnauthorizedHandler).toHaveBeenCalledWith(expect.any(Function));

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("logout"));

    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(clearAccessToken).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );

    unmount();
    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });

  it("returns to the previous page after opening the account menu item", async () => {
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByRole("menuitem", { name: "account" }));
    await user.click(await screen.findByRole("button", { name: "Back" }));

    expect(
      await screen.findByRole("heading", { name: "Dashboard content" }),
    ).toBeVisible();
  });

  it("shows the account name beside the user icon as a tooltip", async () => {
    const { user } = await renderLoadedLayout();

    await user.hover(screen.getByRole("button", { name: "account" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Ada Lovelace",
    );
  });

  it("clears the session for a rejected authentication check", async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValueOnce(
      new AdminApiError("Unauthorized", 401),
    );

    renderLayout();

    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );
    expect(clearAccessToken).toHaveBeenCalledOnce();
  });

  it("shows a loading state while the account is unavailable", () => {
    vi.mocked(fetchCurrentUser).mockReturnValueOnce(
      new Promise(() => undefined),
    );

    const { container } = renderLayout();

    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "logo" }),
    ).not.toBeInTheDocument();
  });

  it("changes theme from the account menu", async () => {
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("darkMode"));

    expect(mocks.core.setTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles compact mode from the item before logout", async () => {
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    const compactItem = await screen.findByText("compactMode");
    const logoutItem = await screen.findByText("logout");
    expect(
      compactItem.compareDocumentPosition(logoutItem) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.click(compactItem);

    expect(mocks.core.setCompact).toHaveBeenCalledWith(true);
  });

  it("offers normal mode when compact mode is active", async () => {
    mocks.core.compact = true;
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("normalMode"));

    expect(mocks.core.setCompact).toHaveBeenCalledWith(false);
  });

  it("clears the local session even when remote logout fails", async () => {
    vi.mocked(logout).mockRejectedValueOnce(new Error("Offline"));
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("logout"));

    await waitFor(() => expect(clearAccessToken).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );
  });

  it("lets the user log out after an account permission denial", async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValueOnce(
      new AdminApiError("Forbidden", 403),
    );
    const { user } = renderLayout();

    const logoutButton = await screen.findByRole("button", { name: "logout" });
    expect(clearAccessToken).not.toHaveBeenCalled();
    await user.click(logoutButton);

    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );
    expect(logout).toHaveBeenCalledOnce();
    expect(clearAccessToken).toHaveBeenCalledOnce();
  });

  it.each([
    new Error("Temporarily offline"),
    new AdminApiError("Forbidden", 403),
  ])("keeps the session and offers retry after $message", async (error) => {
    vi.mocked(fetchCurrentUser).mockRejectedValueOnce(error);
    const { user } = renderLayout();
    await screen.findByText(error.message);
    expect(clearAccessToken).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Dashboard content" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "retry" }));
    await screen.findByRole("heading", { name: "Dashboard content" });
    expect(fetchCurrentUser).toHaveBeenCalledTimes(2);
  });

  it("keeps accepted identity and child input mounted while a refresh fails, then retries", async () => {
    const pending = deferred<CurrentUser>();
    vi.mocked(fetchCurrentUser)
      .mockResolvedValueOnce(mocks.account)
      .mockReturnValueOnce(pending.promise);
    const { user } = renderLayout(<ContextConsumer />);
    const input = await screen.findByLabelText("Unsaved child content");
    await user.type(input, " remains");
    await user.click(screen.getByRole("button", { name: "Refresh account" }));
    expect(screen.getByLabelText("Unsaved child content")).toBe(input);
    expect(input).toHaveValue("Draft remains");

    await act(async () => pending.reject(new Error("Refresh unavailable")));

    expect(await screen.findByText("Refresh unavailable")).toBeVisible();
    expect(screen.getByLabelText("Unsaved child content")).toBe(input);
    expect(input).toHaveValue("Draft remains");
    expect(screen.getByLabelText("account identity")).toHaveTextContent(
      mocks.account.id,
    );
    await user.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() =>
      expect(screen.queryByText("Refresh unavailable")).toBeNull(),
    );
    expect(fetchCurrentUser).toHaveBeenCalledTimes(3);
  });

  it("aborts the owned current-user read and ignores its late rejection on unmount", async () => {
    const pending = deferred<CurrentUser>();
    vi.mocked(fetchCurrentUser).mockReturnValueOnce(pending.promise);
    const { unmount } = renderLayout();
    const signal = vi.mocked(fetchCurrentUser).mock.calls[0][0]!;
    unmount();

    await act(async () => pending.reject(new Error("Obsolete current user")));

    expect(signal.aborted).toBe(true);
    expect(mocks.messages.error).not.toHaveBeenCalled();
    expect(clearAccessToken).not.toHaveBeenCalled();
    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });

  it("ignores an earlier-session current-user failure after a new login", async () => {
    const pending = deferred<CurrentUser>();
    vi.mocked(fetchCurrentUser)
      .mockResolvedValueOnce(mocks.account)
      .mockReturnValueOnce(pending.promise);
    const { user } = renderLayout(<ContextConsumer />);
    await screen.findByLabelText("account identity");
    await user.click(screen.getByRole("button", { name: "Refresh account" }));
    setAccessToken("newer-layout-session");

    await act(async () =>
      pending.reject(new AdminApiError("Obsolete unauthorized", 401)),
    );

    expect(screen.getByLabelText("account identity")).toHaveTextContent(
      mocks.account.id,
    );
    expect(screen.queryByText("Obsolete unauthorized")).toBeNull();
    expect(clearAccessToken).not.toHaveBeenCalled();
    expect(screen.getByLabelText("location")).toHaveTextContent(/^\/$/);
  });

  it("rejects duplicate logout intent before its request settles", async () => {
    const pending = deferred<void>();
    vi.mocked(logout).mockReturnValueOnce(pending.promise);
    const { user } = await renderLoadedLayout();
    await user.click(screen.getByRole("button", { name: "account" }));
    const action = await screen.findByRole("menuitem", { name: "logout" });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(logout).toHaveBeenCalledOnce();

    await act(async () => pending.resolve(undefined));

    await screen.findByRole("heading", { name: "Authentication" });
    expect(clearAccessToken).toHaveBeenCalledOnce();
  });

  it.each(["success", "failure"])(
    "keeps a newer login when an old logout finishes with %s",
    async (outcome) => {
      const pending = deferred<void>();
      vi.mocked(logout).mockReturnValueOnce(pending.promise);
      const { user } = await renderLoadedLayout();
      await user.click(screen.getByRole("button", { name: "account" }));
      await user.click(await screen.findByRole("menuitem", { name: "logout" }));
      setAccessToken("newer-layout-session");

      await act(async () =>
        outcome === "success"
          ? pending.resolve(undefined)
          : pending.reject(new Error("Obsolete logout failure")),
      );

      expect(
        await screen.findByRole("heading", { name: "Dashboard content" }),
      ).toBeVisible();
      expect(clearAccessToken).not.toHaveBeenCalled();
      expect(mocks.messages.error).not.toHaveBeenCalled();
      expect(screen.getByLabelText("location")).toHaveTextContent(/^\/$/);
    },
  );
});
