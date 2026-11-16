// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { deleteRole, fetchPermissions, fetchRoles } from "./api";
import { RolesPage } from "./Roles";
import type { Role } from "./types";

const { messages, modal } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn() },
}));
vi.mock("./api", () => ({
  deleteRole: vi.fn(),
  fetchPermissions: vi.fn(),
  fetchRoles: vi.fn(),
}));
vi.mock("./components/role-form/RoleForm", () => ({ RoleForm: () => null }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, modalAPI: modal }),
}));

const role: Role = {
  id: "role-1",
  name: "Operators",
  permissions: ["users.read"],
};
const user: CurrentUser = {
  id: "synthetic-admin",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  status: "active",
  isSystemAdmin: false,
  permissions: ["roles.read"],
};
const renderPage = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ currentUser: user }} />}>
          <Route path="*" element={<RolesPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  user.permissions = ["roles.read"];
  vi.mocked(fetchRoles).mockResolvedValue([role]);
  vi.mocked(fetchPermissions).mockResolvedValue([]);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("roles listing", () => {
  it("renders read-only roles without requesting editor-only permission metadata", async () => {
    renderPage();

    await screen.findByText("Operators");
    expect(fetchPermissions).not.toHaveBeenCalled();
    for (const action of ["create", "update", "delete"] as const) {
      expect(screen.queryByRole("button", { name: i18n.t(action) })).toBeNull();
    }
    expect(modal.confirm).not.toHaveBeenCalled();
  });

  it("confirms deletion, waits for it, and refreshes the role list", async () => {
    user.permissions.push("roles.delete");
    const pendingDelete = deferred<void>();
    vi.mocked(deleteRole).mockReturnValue(pendingDelete.promise);
    renderPage();
    await screen.findByText("Operators");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("delete") }));
    expect(deleteRole).not.toHaveBeenCalled();
    const confirmation = modal.confirm.mock.calls[0][0] as {
      onOk: () => Promise<void>;
    };
    let pending!: Promise<void>;
    act(() => {
      pending = confirmation.onOk();
    });
    expect(deleteRole).toHaveBeenCalledExactlyOnceWith("role-1");
    expect(fetchRoles).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingDelete.resolve();
      await pending;
    });

    expect(fetchRoles).toHaveBeenCalledTimes(2);
    expect(messages.success).toHaveBeenCalledWith(i18n.t("roleDeleted"));
  });

  it("aborts its list request and ignores a late rejected read after unmount", async () => {
    const pending = deferred<Role[]>();
    vi.mocked(fetchRoles).mockReturnValue(pending.promise);
    const { unmount } = renderPage();
    const signal = vi.mocked(fetchRoles).mock.calls[0][0]!;
    unmount();

    await act(async () => {
      pending.reject(new Error("Synthetic obsolete response"));
    });

    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("keeps a failed delete confirmation rejected and leaves the existing roles visible", async () => {
    user.permissions.push("roles.delete");
    vi.mocked(deleteRole).mockRejectedValue(
      new Error("Synthetic role assigned"),
    );
    renderPage();
    await screen.findByText("Operators");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("delete") }));
    const confirmation = modal.confirm.mock.calls[0][0] as {
      onOk: () => Promise<void>;
    };

    await act(async () => {
      await expect(confirmation.onOk()).rejects.toThrow(
        "Synthetic role assigned",
      );
    });

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Synthetic role assigned"),
    );
    expect(fetchRoles).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Operators")).toBeDefined();
  });
});
