// @vitest-environment jsdom
import { waitFor, within } from "@testing-library/react";
import type * as ReactI18next from "react-i18next";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AdminApiError,
  clearAccessToken,
  setUnauthorizedHandler,
} from "@/shared/api";
import { render, screen } from "@/test/render";
import { deferred } from "@/test/deferred";

import { DefaultLayout } from "./Default";
import type { DefaultLayoutContext } from "./types";

const mocks = vi.hoisted(() => {
  const account: Account = {
    email: "ada@example.com",
    firstName: "Ada",
    id: "user-1",
    isSystemAdmin: false,
    lastName: "Lovelace",
    mobile: "09120000000",
    permissions: ["users.read"],
    status: "active",
    username: "ada",
  };

  return {
    account,
    reloadFinished: vi.fn(),
    core: {
      compact: false,
      currentRoute: "root",
      logos: { dark: "/dark-logo.svg", light: "/light-logo.svg" },
      setCompact: vi.fn(),
      setTheme: vi.fn(),
      setUser: vi.fn(),
      theme: "light",
      user: account as typeof account | undefined,
    },
  };
});

vi.mock("@/features/account/api.ts", () => ({
  getAccount: vi.fn(),
}));
vi.mock("@/features/account", () => ({ fetchCurrentUser: vi.fn() }));
vi.mock("@/features/auth", () => ({ logout: vi.fn() }));
vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof SharedApi>()),
  clearAccessToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));
vi.mock("antd-style", async (original) => ({
  ...(await original<typeof AntdStyle>()),
  useResponsive: () => responsive,
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({
    messageAPI: messages,
    token: {
      marginMD: 16,
      paddingMD: 16,
      paddingSM: 8,
      paddingXS: 4,
      size: 16,
      screenXXXL: 1920,
    },
  }),
  useCore: () => ({
    compact: false,
    currentRoute: "root",
    theme: "light",
    setTheme,
    setCompact,
    settings: {
      lightLogo: { url: "/synthetic-logo.svg" },
      language: { direction: "ltr" },
    },
  }),
}));

const currentUser: DefaultLayoutContext["currentUser"] = {
  id: "synthetic-admin",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  status: "active",
  isSystemAdmin: false,
  permissions: ["users.read"],
};
const Consumer = () => {
  const context = useOutletContext<DefaultLayoutContext>();
  return <h1>{context.currentUser.firstName}'s dashboard</h1>;
};

const ContextConsumer = () => {
  const { clearSession, currentUser, fetchCurrentUser } =
    useOutletContext<DefaultLayoutContext>();

  return (
    <>
      <output aria-label="account identity">{currentUser.id}</output>
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
    <MemoryRouter>
      <Routes>
        <Route element={<DefaultLayout />} path="/">
          <Route index element={content} />
          <Route element={<AccountPage />} path="account" />
          <Route element={<h1>Users content</h1>} path="users" />
        </Route>
        <Route path="/auth" element={<h1>Authentication</h1>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  responsive.lg = true;
  vi.mocked(fetchCurrentUser).mockResolvedValue(currentUser);
  vi.mocked(logout).mockResolvedValue(undefined);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("DefaultLayout", () => {
  it("exposes the accepted account, awaited reload and session cleanup to its children", async () => {
    const response = deferred<Account>();
    const updated = { ...mocks.account, lastName: "Updated" };
    vi.mocked(getAccount)
      .mockResolvedValueOnce(mocks.account)
      .mockReturnValueOnce(response.promise);
    const { user } = renderLayout(<ContextConsumer />);

    expect(await screen.findByLabelText("account identity")).toHaveTextContent(
      mocks.account.id,
    );
    await user.click(screen.getByRole("button", { name: "Refresh account" }));
    expect(getAccount).toHaveBeenCalledTimes(2);
    expect(mocks.reloadFinished).not.toHaveBeenCalled();

    response.resolve(updated);
    await waitFor(() =>
      expect(mocks.core.setUser).toHaveBeenCalledWith(updated),
    );
    await waitFor(() => expect(mocks.reloadFinished).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: "Clear session" }));
    expect(clearAccessToken).toHaveBeenCalledOnce();
    expect(mocks.core.setUser).toHaveBeenCalledWith();
    await screen.findByRole("heading", { name: "Authentication" });
  });

  it.each(["pointer", "keyboard"])(
    "closes the mobile drawer after %s navigation without remounting the layout",
    async (interaction) => {
      const { user } = await renderLoadedLayout();
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
      expect(getAccount).toHaveBeenCalledOnce();
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
    expect(getAccount).toHaveBeenCalledOnce();
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
    await waitFor(() => expect(getAccount).toHaveBeenCalledOnce());
    expect(mocks.core.setUser).toHaveBeenCalledWith(mocks.account);
    expect(setUnauthorizedHandler).toHaveBeenCalledWith(expect.any(Function));

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("logout"));

    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(clearAccessToken).toHaveBeenCalledOnce();
    expect(mocks.core.setUser).toHaveBeenLastCalledWith();
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
    vi.mocked(getAccount).mockRejectedValueOnce(
      new AdminApiError("Unauthorized", 401),
    );

    renderLayout();

    await screen.findByRole("heading", { name: "Ada's dashboard" });
    expect(fetchCurrentUser).toHaveBeenCalledExactlyOnceWith(
      expect.any(AbortSignal),
    );
    expect(
      screen.getByRole("img", { name: i18n.t("logo") }).getAttribute("src"),
    ).toBe("/synthetic-logo.svg");
    expect(setUnauthorizedHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it("reports an initial account read failure without clearing the session", async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValueOnce(
      new Error("Synthetic account unavailable"),
    );
    renderLayout();
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith(
        "Synthetic account unavailable",
      ),
    );
    expect(
      await screen.findByText(i18n.t("currentUserLoadFailed")),
    ).toBeDefined();
    expect(document.querySelector(".ant-spin-fullscreen")).toBeNull();
    expect(clearAccessToken).not.toHaveBeenCalled();
  });

  it("clears local credentials and navigates to authentication after remote logout failure", async () => {
    vi.mocked(logout).mockRejectedValue(
      new Error("Synthetic logout unavailable"),
    );
    renderLayout();
    await screen.findByRole("heading", { name: "Ada's dashboard" });
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: i18n.t("account") }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: i18n.t("logout") }),
    );

    await screen.findByRole("heading", { name: "Authentication" });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(clearAccessToken).toHaveBeenCalledTimes(1);
    expect(messages.error).toHaveBeenCalledWith("Synthetic logout unavailable");
  });

  it("aborts account loading and unregisters its unauthorized handler on unmount", async () => {
    const pending = deferred<DefaultLayoutContext["currentUser"]>();
    vi.mocked(fetchCurrentUser).mockReturnValue(pending.promise);
    const { unmount } = renderLayout();
    const signal = vi.mocked(fetchCurrentUser).mock.calls[0][0]!;
    unmount();

    await act(async () => {
      pending.reject(new Error("Synthetic obsolete account response"));
    });

    expect(signal.aborted).toBe(true);
    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("responds to a transport unauthorized notification by clearing the current session", async () => {
    renderLayout();
    await screen.findByRole("heading", { name: "Ada's dashboard" });
    const handler = vi.mocked(setUnauthorizedHandler).mock.calls.at(-1)![0]!;

    act(() => {
      handler();
    });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Authentication" }),
      ).toBeDefined(),
    );
    expect(clearAccessToken).toHaveBeenCalledTimes(1);
  });
});
