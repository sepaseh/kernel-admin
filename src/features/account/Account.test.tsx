// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword } from "@/features/auth";
import type { DefaultLayoutContext } from "@/layouts/default";
import { i18nInstance } from "@/shared/i18n";
import { render, screen } from "@/test/render";

import { AccountPage } from "./Account";
import { updateProfile } from "./api";
import type { CurrentUser } from "./types";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("./api", () => ({ updateProfile: vi.fn() }));
vi.mock("@/features/auth", () => ({ changePassword: vi.fn() }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, token: { marginMD: 16 } }),
}));

const currentUser: CurrentUser = {
  firstName: "Ada",
  id: "account-1",
  isSystemAdmin: false,
  lastName: "Lovelace",
  mobile: "09120000000",
  permissions: [],
  status: "active",
};
const fetchCurrentUser = vi.fn<DefaultLayoutContext["fetchCurrentUser"]>();
const clearSession = vi.fn<DefaultLayoutContext["clearSession"]>();
const DefaultCurrentUserOutlet = () => (
  <Outlet
    context={
      {
        clearSession,
        currentUser,
        fetchCurrentUser,
      } satisfies DefaultLayoutContext
    }
  />
);

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
  vi.mocked(updateProfile).mockReset().mockResolvedValue(currentUser);
  vi.mocked(changePassword).mockReset().mockResolvedValue(undefined);
  fetchCurrentUser.mockReset().mockResolvedValue(undefined);
});

describe("AccountPage", () => {
  it("shows independent profile and password forms for the current account", async () => {
    const { user } = render(
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route element={<DefaultCurrentUserOutlet />}>
            <Route element={<AccountPage />} path="/account" />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const firstName = screen.getByLabelText(i18nInstance.t("firstName"));
    expect(firstName).toHaveValue("Ada");
    expect(screen.getByLabelText(i18nInstance.t("lastName"))).toHaveValue(
      "Lovelace",
    );
    expect(
      screen.getByLabelText(i18nInstance.t("currentPassword")),
    ).toHaveValue("");
    await user.clear(firstName);
    await user.type(firstName, "Augusta");
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        { firstName: "Augusta", lastName: "Lovelace" },
        expect.any(AbortSignal),
      ),
    );
    expect(changePassword).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
  });
});
