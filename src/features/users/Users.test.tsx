// @vitest-environment jsdom
import { act, fireEvent, waitFor } from "@testing-library/react";
import type * as ReactI18next from "react-i18next";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { fetchRoles } from "@/features/roles/api";
import { clearAccessToken, setAccessToken } from "@/shared/api/token";
import { render, screen } from "@/test/render";
import { users } from "@/test/storybook/fixtures";

import { deleteUser, fetchUser, fetchUsers, updateUserPassword } from "./api";
import { UsersPage } from "./Users";

const mocks = vi.hoisted(() => ({
  messageAPI: { error: vi.fn(), success: vi.fn() },
  modalAPI: { confirm: vi.fn() },
  notificationAPI: { success: vi.fn() },
  permissions: { canCreate: false, canDelete: true, canUpdate: false },
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => mocks,
  useCore: () => ({ user: { isSystemAdmin: false } }),
}));
vi.mock("@/app/lib", () => ({ getRoutePermissions: () => mocks.permissions }));
vi.mock("@/features/roles/api", () => ({ fetchRoles: vi.fn() }));
vi.mock("./api", () => ({
  deleteUser: vi.fn(),
  fetchUser: vi.fn(),
  fetchUsers: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserStatus: vi.fn(),
  updateUserSystemAdmin: vi.fn(),
}));
vi.mock("@/features/users/components/user-form/UserForm", () => ({
  UserForm: ({ data }: { data?: { id: string } }) => (
    <output aria-label="selected user">{data?.id}</output>
  ),
}));
vi.mock("@/features/users/components/user-role-form/UserRoleForm", () => ({
  UserRoleForm: () => null,
}));
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof ReactI18next>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderUsers = () =>
  render(
    <MemoryRouter>
      <UsersPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  clearAccessToken();
  mocks.permissions.canCreate = false;
  mocks.permissions.canDelete = true;
  mocks.permissions.canUpdate = false;
  vi.mocked(fetchRoles).mockReset().mockResolvedValue([]);
  vi.mocked(deleteUser).mockReset().mockResolvedValue(undefined);
  vi.mocked(updateUserPassword).mockReset().mockResolvedValue(undefined);
  vi.mocked(fetchUsers).mockReset().mockResolvedValue({
    items: users,
    total: users.length,
  });
});

const beginPasswordReset = async () => {
  mocks.permissions.canUpdate = true;
  const view = renderUsers();
  const clipboard = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue(undefined);
  await screen.findByText("Sara Ahmadi");
  await view.user.click(screen.getAllByRole("button", { name: "password" })[0]);
  const confirmation = mocks.modalAPI.confirm.mock.calls[0][0] as {
    onCancel: () => void;
    onOk: () => Promise<void>;
  };
  let completion!: Promise<void>;
  act(() => {
    completion = confirmation.onOk();
  });
  await waitFor(() => expect(updateUserPassword).toHaveBeenCalledOnce());
  return { ...view, clipboard, completion, confirmation };
};

it.each(["unmount", "cancel", "permission"] as const)(
  "reveals an acknowledged password reset after %s within the same login",
  async (change) => {
    let release!: () => void;
    vi.mocked(updateUserPassword).mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve(undefined);
      }),
    );
    const view = await beginPasswordReset();
    const password = vi.mocked(updateUserPassword).mock.calls[0][1].password;
    if (change === "unmount") view.unmount();
    else if (change === "cancel") act(() => view.confirmation.onCancel());
    else {
      mocks.permissions.canUpdate = false;
      view.rerender(
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>,
      );
    }
    expect(vi.mocked(updateUserPassword).mock.calls[0][2]?.aborted).toBe(true);
    await act(async () => {
      release();
      await view.completion;
    });
    expect(mocks.notificationAPI.success).toHaveBeenCalledExactlyOnceWith({
      description: password,
      message: "password",
    });
    expect(view.clipboard).toHaveBeenCalledExactlyOnceWith(password);
    expect(mocks.messageAPI.success).not.toHaveBeenCalled();
    expect(mocks.messageAPI.error).not.toHaveBeenCalled();
    expect(fetchUsers).toHaveBeenCalledOnce();
  },
);

it.each(["login", "logout"] as const)(
  "never reveals a completed password reset after %s changes the session",
  async (change) => {
    let release!: () => void;
    vi.mocked(updateUserPassword).mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve(undefined);
      }),
    );
    const view = await beginPasswordReset();
    act(() => {
      if (change === "login") setAccessToken("synthetic-new-login");
      else clearAccessToken();
    });
    await act(async () => {
      release();
      await view.completion;
    });
    expect(mocks.notificationAPI.success).not.toHaveBeenCalled();
    expect(view.clipboard).not.toHaveBeenCalled();
    expect(mocks.messageAPI.success).not.toHaveBeenCalled();
    expect(mocks.messageAPI.error).not.toHaveBeenCalled();
  },
);

it("does not claim or reveal a password when the canceled reset rejects", async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(updateUserPassword).mockReturnValueOnce(
    new Promise((_, rejectRequest) => {
      reject = rejectRequest;
    }),
  );
  const view = await beginPasswordReset();
  act(() => view.confirmation.onCancel());
  await act(async () => {
    reject(new Error("Synthetic request did not acknowledge success"));
    await view.completion;
  });
  expect(mocks.notificationAPI.success).not.toHaveBeenCalled();
  expect(view.clipboard).not.toHaveBeenCalled();
  expect(mocks.messageAPI.error).not.toHaveBeenCalled();
});

it("reveals a currently completed password reset once", async () => {
  const view = await beginPasswordReset();
  await act(async () => view.completion);
  const password = vi.mocked(updateUserPassword).mock.calls[0][1].password;
  expect(password).toMatch(/^[a-z0-9]{16}$/);
  expect(mocks.notificationAPI.success).toHaveBeenCalledExactlyOnceWith({
    description: password,
    message: "password",
  });
  expect(view.clipboard).toHaveBeenCalledExactlyOnceWith(password);
});

it("does not start an old delete confirmation after delete permission is revoked", async () => {
  const { user, rerender } = renderUsers();
  await screen.findByText("Sara Ahmadi");
  await user.click(screen.getAllByRole("button", { name: "delete" })[0]);
  const confirmation = mocks.modalAPI.confirm.mock.calls[0][0] as {
    onOk: () => Promise<void>;
  };
  mocks.permissions.canDelete = false;
  rerender(
    <MemoryRouter>
      <UsersPage />
    </MemoryRouter>,
  );
  await act(async () => confirmation.onOk());
  expect(deleteUser).not.toHaveBeenCalled();
  expect(mocks.messageAPI.success).not.toHaveBeenCalled();
});

it("does not notify or reload after a pending deletion's page unmounts", async () => {
  let release!: () => void;
  vi.mocked(deleteUser).mockReturnValueOnce(
    new Promise((resolve) => {
      release = () => resolve(undefined);
    }),
  );
  const { user, unmount } = renderUsers();
  await screen.findByText("Sara Ahmadi");
  await user.click(screen.getAllByRole("button", { name: "delete" })[0]);
  const confirmation = mocks.modalAPI.confirm.mock.calls[0][0] as {
    onOk: () => Promise<void>;
  };
  let pending!: Promise<void>;
  act(() => {
    pending = confirmation.onOk();
  });
  await waitFor(() => expect(deleteUser).toHaveBeenCalledOnce());
  unmount();
  expect(vi.mocked(deleteUser).mock.calls[0][1]?.aborted).toBe(true);
  await act(async () => {
    release();
    await pending;
  });
  expect(mocks.messageAPI.success).not.toHaveBeenCalled();
  expect(mocks.messageAPI.error).not.toHaveBeenCalled();
  expect(fetchUsers).toHaveBeenCalledOnce();
});

it("invalidates a pending deletion immediately when its confirmation is canceled", async () => {
  let release!: () => void;
  vi.mocked(deleteUser).mockReturnValueOnce(
    new Promise((resolve) => {
      release = () => resolve(undefined);
    }),
  );
  const { user } = renderUsers();
  await screen.findByText("Sara Ahmadi");
  await user.click(screen.getAllByRole("button", { name: "delete" })[0]);
  const confirmation = mocks.modalAPI.confirm.mock.calls[0][0] as {
    onOk: () => Promise<void>;
    onCancel: () => void;
  };
  let pending!: Promise<void>;
  act(() => {
    pending = confirmation.onOk();
  });
  await waitFor(() => expect(deleteUser).toHaveBeenCalledOnce());
  act(() => confirmation.onCancel());
  expect(vi.mocked(deleteUser).mock.calls[0][1]?.aborted).toBe(true);
  await act(async () => {
    release();
    await pending;
  });
  expect(mocks.messageAPI.success).not.toHaveBeenCalled();
  expect(fetchUsers).toHaveBeenCalledOnce();
});

it.each(["invalid", "-12", "Infinity", "1.5"])(
  "normalizes an invalid pagination offset %s before requesting users",
  async (offset) => {
    render(
      <MemoryRouter initialEntries={[`/?offset=${offset}`]}>
        <UsersPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledOnce());
    expect(vi.mocked(fetchUsers).mock.calls[0][0]).toMatchObject({
      offset: "0",
      size: "12",
    });
  },
);

it("distinguishes initial failure from successful empty results and retries explicitly", async () => {
  vi.mocked(fetchUsers)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ items: [], total: 0 });
  const { user } = renderUsers();
  await screen.findByText("requestLoadFailed");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText("No data")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "retry" }));
  expect(
    await screen.findByText("No data", { selector: ".ant-empty-description" }),
  ).toBeVisible();
  expect(screen.queryByText("requestLoadFailed")).not.toBeInTheDocument();
  expect(fetchUsers).toHaveBeenCalledTimes(2);
  expect(mocks.messageAPI.error).not.toHaveBeenCalled();
});

it("keeps the last successful rows with a persistent warning when mutation refetch fails", async () => {
  vi.mocked(fetchUsers)
    .mockResolvedValueOnce({ items: users, total: 2 })
    .mockRejectedValueOnce(new Error("Refresh offline"));
  const { user } = renderUsers();
  await screen.findByText("Sara Ahmadi");
  await user.click(screen.getAllByRole("button", { name: "delete" })[0]);
  const confirmation = mocks.modalAPI.confirm.mock.calls[0][0] as {
    onOk: () => Promise<void>;
  };
  await act(async () => {
    await confirmation.onOk();
  });
  expect(screen.getByText("requestRefreshFailed")).toBeVisible();
  expect(screen.getByText("Sara Ahmadi")).toBeVisible();
  expect(mocks.messageAPI.error).not.toHaveBeenCalled();
});

it("only opens the newest requested detail when responses finish in reverse order", async () => {
  mocks.permissions.canUpdate = true;
  const releases: ((value: (typeof users)[number]) => void)[] = [];
  vi.mocked(fetchUser).mockImplementation(
    () =>
      new Promise((resolve) => {
        releases.push(resolve);
      }),
  );
  renderUsers();
  await screen.findByText("Sara Ahmadi");
  const buttons = screen.getAllByRole("button", { name: "update" });
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);
  expect(vi.mocked(fetchUser).mock.calls[0][1]?.aborted).toBe(true);
  await act(async () => releases[1](users[1]));
  await waitFor(() =>
    expect(screen.getByLabelText("selected user")).toHaveTextContent("user-2"),
  );
  await act(async () => releases[0](users[0]));
  expect(screen.getByLabelText("selected user")).toHaveTextContent("user-2");
  expect(mocks.messageAPI.error).not.toHaveBeenCalled();
});
