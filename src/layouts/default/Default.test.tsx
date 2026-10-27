// @vitest-environment jsdom
import { waitFor, within } from "@testing-library/react";
import type * as ReactI18next from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccount } from "@/features/account/api.ts";
import type { Account } from "@/features/account/types";
import { logout } from "@/features/auth/api.ts";
import type * as SharedApi from "@/shared/api";
import {
  AdminApiError,
  clearAccessToken,
  setUnauthorizedHandler,
} from "@/shared/api";
import { render, screen } from "@/test/render";

import { DefaultLayout } from "./Default";

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

vi.mock("@/features/auth/api.ts", () => ({
  logout: vi.fn(),
}));

vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  clearAccessToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock("@/app/hooks", () => ({
  useCore: () => mocks.core,
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

const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Location />
      <Routes>
        <Route element={<DefaultLayout />} path="/">
          <Route index element={<h1>Dashboard content</h1>} />
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

beforeEach(() => {
  mocks.core.compact = false;
  mocks.core.currentRoute = "root";
  mocks.core.theme = "light";
  mocks.core.user = mocks.account;
  vi.mocked(getAccount).mockResolvedValue(mocks.account);
  vi.mocked(logout).mockResolvedValue(undefined);
});

describe("DefaultLayout", () => {
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

    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );
    expect(clearAccessToken).toHaveBeenCalledOnce();
    expect(mocks.core.setUser).toHaveBeenCalledWith();
  });

  it("shows a loading state while the account is unavailable", () => {
    mocks.core.user = undefined;
    vi.mocked(getAccount).mockReturnValueOnce(new Promise(() => undefined));

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
    expect(mocks.core.setUser).toHaveBeenLastCalledWith();
    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );
  });

  it("keeps a transient session-read failure retryable and hides protected content", async () => {
    vi.mocked(getAccount).mockRejectedValueOnce(
      new Error("Temporarily offline"),
    );
    const { user } = renderLayout();
    await screen.findByText("Temporarily offline");
    expect(clearAccessToken).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Dashboard content" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "retry" }));
    await screen.findByRole("heading", { name: "Dashboard content" });
    expect(getAccount).toHaveBeenCalledTimes(2);
  });
});
