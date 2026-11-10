import "@/test/browser";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type * as AntdStyle from "antd-style";
import { MemoryRouter, Route, Routes, useOutletContext } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCurrentUser } from "@/features/account";
import { logout } from "@/features/auth";
import type * as SharedApi from "@/shared/api";
import { clearAccessToken, setUnauthorizedHandler } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { DefaultLayout } from "./Default";
import type { DefaultLayoutContext } from "./types";

const { messages, setTheme, setCompact, responsive } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  setTheme: vi.fn(),
  setCompact: vi.fn(),
  responsive: { lg: true },
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
const renderLayout = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<DefaultLayout />}>
          <Route index element={<Consumer />} />
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

describe("default layout session lifecycle", () => {
  it("loads the current user and supplies it to route children", async () => {
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
