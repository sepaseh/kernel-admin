// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import type * as ReactI18next from "react-i18next";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render";

import { deleteRole, fetchPermissions, fetchRole, fetchRoles } from "./api";
import { RolesPage } from "./Roles";

const mocks = vi.hoisted(() => ({
  messageAPI: { error: vi.fn(), success: vi.fn() },
  modalAPI: { confirm: vi.fn() },
  permissions: { canCreate: false, canDelete: true, canUpdate: false },
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => mocks,
  useCore: () => ({ user: { id: "admin-1", isSystemAdmin: false } }),
}));
vi.mock("@/app/lib", () => ({ getRoutePermissions: () => mocks.permissions }));
vi.mock("./api", () => ({
  deleteRole: vi.fn(),
  fetchPermissions: vi.fn(),
  fetchRole: vi.fn(),
  fetchRoles: vi.fn(),
}));
vi.mock("@/features/roles/components/role-form/RoleForm", () => ({
  RoleForm: () => null,
}));
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof ReactI18next>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  mocks.permissions.canCreate = false;
  mocks.permissions.canDelete = true;
  mocks.permissions.canUpdate = false;
  vi.mocked(deleteRole).mockReset().mockResolvedValue(undefined);
  vi.mocked(fetchPermissions).mockReset().mockResolvedValue([]);
  vi.mocked(fetchRole)
    .mockReset()
    .mockResolvedValue({ id: "role-1", name: "Operators", permissions: [] });
  vi.mocked(fetchRoles)
    .mockReset()
    .mockResolvedValue([{ id: "role-1", name: "Operators", permissions: [] }]);
});

const renderRoles = () =>
  render(
    <MemoryRouter>
      <RolesPage />
    </MemoryRouter>,
  );

it("keeps an initial read failure retryable and distinguishes recovery from empty data", async () => {
  vi.mocked(fetchRoles)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce([]);
  const { user } = renderRoles();
  await screen.findByText("requestLoadFailed");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "retry" }));
  expect(
    await screen.findByText("No data", { selector: ".ant-empty-description" }),
  ).toBeVisible();
  expect(fetchRoles).toHaveBeenCalledTimes(2);
  expect(mocks.messageAPI.error).not.toHaveBeenCalled();
});

it("does not start an old delete confirmation after permission is revoked", async () => {
  const { user, rerender } = renderRoles();
  await screen.findByText("Operators");
  await user.click(screen.getByRole("button", { name: "delete" }));
  const confirmation = mocks.modalAPI.confirm.mock.calls[0][0] as {
    onOk: () => Promise<void>;
  };
  mocks.permissions.canDelete = false;
  rerender(
    <MemoryRouter>
      <RolesPage />
    </MemoryRouter>,
  );
  await act(async () => confirmation.onOk());
  expect(deleteRole).not.toHaveBeenCalled();
  expect(mocks.messageAPI.success).not.toHaveBeenCalled();
});

it("aborts a pending deletion on unmount without notifying or reloading", async () => {
  let release!: () => void;
  vi.mocked(deleteRole).mockReturnValueOnce(
    new Promise((resolve) => {
      release = () => resolve(undefined);
    }),
  );
  const { user, unmount } = renderRoles();
  await screen.findByText("Operators");
  await user.click(screen.getByRole("button", { name: "delete" }));
  const confirmation = mocks.modalAPI.confirm.mock.calls[0][0] as {
    onOk: () => Promise<void>;
  };
  let pending!: Promise<void>;
  act(() => {
    pending = confirmation.onOk();
  });
  await waitFor(() => expect(deleteRole).toHaveBeenCalledOnce());
  unmount();
  expect(vi.mocked(deleteRole).mock.calls[0][1]?.aborted).toBe(true);
  await act(async () => {
    release();
    await pending;
  });
  expect(mocks.messageAPI.success).not.toHaveBeenCalled();
  expect(mocks.messageAPI.error).not.toHaveBeenCalled();
  expect(fetchRoles).toHaveBeenCalledOnce();
});
