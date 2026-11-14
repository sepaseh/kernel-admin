import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { i18n } from "@/shared/i18n";
import "@/test/browser";
import { deferred } from "@/test/deferred";

import { createRole, fetchRole, updateRole } from "../../api";
import type { PermissionGroup, Role } from "../../types";
import { RoleForm } from "./RoleForm";

const { messages, onFinish } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  onFinish: vi.fn(),
}));
vi.mock("../../api", () => ({
  createRole: vi.fn(),
  fetchRole: vi.fn(),
  updateRole: vi.fn(),
}));
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
const permissions: PermissionGroup[] = [
  {
    name: "users",
    title: "User management",
    permissions: [
      { name: "users.read", title: "Read users" },
      { name: "users.update", title: "Update users" },
    ],
  },
];
const FormNavigation = () => {
  const { hash } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate("/roles#other")}>
        Leave role form
      </button>
      <output aria-label="Role form hash">{hash}</output>
    </>
  );
};
const renderForm = (entry = "/roles#create", id?: string, navigation = false) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      {navigation && <FormNavigation />}
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route
            path="/roles"
            element={
              <RoleForm id={id} onFinish={onFinish} options={{ permissions }} />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  currentUser.isSystemAdmin = true;
  vi.mocked(fetchRole).mockResolvedValue({
    id: "role-1",
    name: "Operators",
    permissions: ["users.read"],
  });
  vi.mocked(createRole).mockResolvedValue({
    id: "created-role",
    name: "Operators",
    permissions: [],
  });
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("role drawer", () => {
  it("selects a permission group and submits the owned permission names", async () => {
    renderForm();
    const name = await screen.findByRole("textbox", { name: i18n.t("name") });
    await waitFor(() => expect(document.activeElement).toBe(name));
    fireEvent.change(name, { target: { value: "Operators" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "User management" }));
    expect(
      (screen.getByRole("checkbox", { name: "Read users" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Update users",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(createRole).toHaveBeenCalledExactlyOnceWith(
      {
        name: "Operators",
        permissions: ["users.read", "users.update"],
      },
      expect.any(AbortSignal),
    );
    expect(updateRole).not.toHaveBeenCalled();
  });

  it("loads an edited role before submitting its changed name", async () => {
    renderForm("/roles#update", "role-1");
    const name = await screen.findByDisplayValue("Operators");
    await waitFor(() => expect(document.activeElement).toBe(name));
    fireEvent.change(name, { target: { value: "Reviewers" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() =>
      expect(updateRole).toHaveBeenCalledExactlyOnceWith(
        "role-1",
        {
          name: "Reviewers",
          permissions: ["users.read"],
        },
        expect.any(AbortSignal),
      ),
    );
    expect(createRole).not.toHaveBeenCalled();
  });

  it("rejects unauthorized hashes without fetching role details", async () => {
    currentUser.isSystemAdmin = false;
    renderForm("/roles#update", "role-1");
    await act(async () => undefined);

    expect(fetchRole).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["success", "error"])(
    "ignores a late save %s after leaving the form even when transport ignores abort",
    async (outcome) => {
      const pending = deferred<Role>();
      vi.mocked(createRole).mockReturnValue(pending.promise);
      renderForm("/roles#create", undefined, true);
      fireEvent.change(
        await screen.findByRole("textbox", { name: i18n.t("name") }),
        {
          target: { value: "Operators" },
        },
      );
      fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));
      await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1));
      const signal = vi.mocked(createRole).mock.calls[0][1]!;

      fireEvent.click(screen.getByRole("button", { name: "Leave role form" }));
      expect(signal.aborted).toBe(true);
      await act(async () => {
        if (outcome === "success")
          pending.resolve({
            id: "created-role",
            name: "Operators",
            permissions: [],
          });
        else pending.reject(new Error("Synthetic obsolete save"));
      });

      expect(messages.success).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Role form hash").textContent).toBe(
        "#other",
      );
    },
  );

  it("cancels a detail read when closing the drawer and ignores its late response", async () => {
    const pending = deferred<Role>();
    vi.mocked(fetchRole).mockReturnValue(pending.promise);
    const { unmount } = renderForm("/roles#update", "role-1");
    const signal = vi.mocked(fetchRole).mock.calls[0][1]!;
    unmount();

    await act(async () => {
      pending.resolve({ id: "role-1", name: "Obsolete", permissions: [] });
    });

    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
