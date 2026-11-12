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
import "@/test/browser";
import { deferred } from "@/test/deferred";

import { fetchUser, updateUserRoles } from "../../api";
import type { User } from "../../types";
import { UserRoleForm } from "./UserRoleForm";

const { messages, onFinish } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  onFinish: vi.fn(),
}));
vi.mock("../../api", () => ({ fetchUser: vi.fn(), updateUserRoles: vi.fn() }));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));

const currentUser: CurrentUser = {
  id: "synthetic-editor",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  status: "active",
  isSystemAdmin: true,
  permissions: [],
};
const user: User = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  status: "active",
  isSystemAdmin: false,
  roles: [{ id: "role-1", name: "Readers" }],
};
const roles = [
  { id: "role-1", name: "Readers", permissions: [] },
  { id: "role-2", name: "Editors", permissions: [] },
];
const renderForm = (entry = "/users#roles") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route
            path="/users"
            element={
              <UserRoleForm
                id="user-1"
                onFinish={onFinish}
                options={{ roles }}
              />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchUser).mockResolvedValue(user);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("user role drawer", () => {
  it("loads selected roles and persists role identifiers instead of labels", async () => {
    renderForm();
    const readers = await screen.findByRole("checkbox", { name: "Readers" });
    await waitFor(() =>
      expect((readers as HTMLInputElement).checked).toBe(true),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Editors" }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() =>
      expect(updateUserRoles).toHaveBeenCalledExactlyOnceWith(
        "user-1",
        {
          roleIds: ["role-1", "role-2"],
        },
        expect.any(AbortSignal),
      ),
    );
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(messages.success).toHaveBeenCalledWith(i18n.t("rolesUpdated"));
  });

  it("keeps selected roles after a rejected save and allows a successful retry", async () => {
    const pending = deferred<void>();
    vi.mocked(updateUserRoles)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(undefined);
    renderForm();
    const readers = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "Readers",
    });
    await waitFor(() => expect(readers.checked).toBe(true));
    const editors = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Editors",
    });
    fireEvent.click(editors);
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: i18n.t("submit"),
    });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);
    await waitFor(() => {
      expect(updateUserRoles).toHaveBeenCalledTimes(1);
      expect(submit.disabled).toBe(true);
    });
    expect(editors.disabled).toBe(true);

    await act(async () => {
      pending.reject(new Error("Synthetic user roles save rejected"));
    });

    await waitFor(() => expect(submit.disabled).toBe(false));
    expect(messages.error).toHaveBeenCalledExactlyOnceWith(
      "Synthetic user roles save rejected",
    );
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(readers.checked).toBe(true);
    expect(editors.checked).toBe(true);
    expect(editors.disabled).toBe(false);
    expect(onFinish).not.toHaveBeenCalled();
    expect(messages.success).not.toHaveBeenCalled();

    fireEvent.click(submit);

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(updateUserRoles).toHaveBeenCalledTimes(2);
    expect(updateUserRoles).toHaveBeenLastCalledWith(
      "user-1",
      { roleIds: ["role-1", "role-2"] },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("rolesUpdated"),
    );
  });

  it("ignores a sibling drawer hash without loading user roles", async () => {
    renderForm("/users#update");
    await act(async () => undefined);

    expect(fetchUser).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels its detail request and suppresses late errors after unmount", async () => {
    const pending = deferred<User>();
    vi.mocked(fetchUser).mockReturnValue(pending.promise);
    const { unmount } = renderForm();
    const signal = vi.mocked(fetchUser).mock.calls[0][1]!;
    unmount();

    await act(async () => {
      pending.reject(new Error("Synthetic obsolete user roles"));
    });

    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
    expect(updateUserRoles).not.toHaveBeenCalled();
  });
});
