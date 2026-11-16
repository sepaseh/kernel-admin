// @vitest-environment jsdom

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
import { fetchRoles } from "@/features/roles";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { fetchUsers } from "./api";
import type { User } from "./types";
import { UsersPage } from "./Users";

const { messages } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("./api", () => ({
  fetchUsers: vi.fn(),
  deleteUser: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserSystemAdmin: vi.fn(),
}));
vi.mock("./components/user-form", () => ({ UserForm: () => null }));
vi.mock("./components/user-role-form", () => ({ UserRoleForm: () => null }));
vi.mock("@/features/roles", () => ({ fetchRoles: vi.fn() }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({
    messageAPI: messages,
    modalAPI: { confirm: vi.fn() },
    token: { marginLG: 16 },
  }),
}));

const operator: User = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  status: "active",
  isSystemAdmin: false,
  roles: [],
};
const currentUser: CurrentUser = { ...operator, permissions: ["users.read"] };
const Location = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <output aria-label="location">{location.search}</output>
      <button onClick={() => void navigate("/users?firstName=Grace&page=1")}>
        Replace query
      </button>
    </>
  );
};
const renderPage = (entry = "/users") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route
            path="/users"
            element={
              <>
                <Location />
                <UsersPage />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  currentUser.permissions = ["users.read"];
  vi.mocked(fetchUsers).mockResolvedValue({ items: [operator], total: 1 });
  vi.mocked(fetchRoles).mockResolvedValue([]);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("users listing", () => {
  it("hydrates URL filters and hides privileged actions for a read-only account", async () => {
    renderPage("/users?firstName=Ada&page=2&status=active");

    await screen.findByText("Ada Lovelace");
    expect(fetchUsers).toHaveBeenCalledWith(
      { firstName: "Ada", page: "2", status: "active" },
      expect.any(AbortSignal),
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: i18n.t("firstName"),
        }) as HTMLInputElement
      ).value,
    ).toBe("Ada");
    expect(fetchRoles).not.toHaveBeenCalled();
    for (const action of [
      "create",
      "update",
      "delete",
      "password",
      "roles",
    ] as const) {
      expect(screen.queryByRole("button", { name: i18n.t(action) })).toBeNull();
    }
  });

  it("aborts the old query and keeps replacement results when the old response arrives late", async () => {
    const stale = deferred<{ items: User[]; total: number }>();
    vi.mocked(fetchUsers)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({
        items: [{ ...operator, firstName: "Grace" }],
        total: 1,
      });
    renderPage("/users?firstName=Ada");
    const oldSignal = vi.mocked(fetchUsers).mock.calls[0][1]!;
    fireEvent.click(screen.getByRole("button", { name: "Replace query" }));
    await screen.findByText("Grace Lovelace");
    expect(oldSignal.aborted).toBe(true);

    await act(async () => {
      stale.resolve({ items: [operator], total: 1 });
    });

    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getByText("Grace Lovelace")).toBeDefined();
  });

  it("debounces text changes and resets pagination in the URL", async () => {
    renderPage("/users?page=3");
    await screen.findByText("Ada Lovelace");
    fireEvent.change(
      screen.getByRole("textbox", { name: i18n.t("firstName") }),
      { target: { value: "Grace" } },
    );

    await waitFor(() =>
      expect(fetchUsers).toHaveBeenLastCalledWith(
        { firstName: "Grace", status: undefined },
        expect.any(AbortSignal),
      ),
    );
    expect(screen.getByLabelText("location").textContent).toBe(
      "?firstName=Grace",
    );
  });
});
