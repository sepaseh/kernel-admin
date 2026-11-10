import {
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

import { createUser, fetchUser, updateUser } from "../../api";
import type { User } from "../../types";
import { UserForm } from "./UserForm";

const { messages, notification, onFinish } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  notification: { success: vi.fn() },
  onFinish: vi.fn(),
}));
vi.mock("../../api", () => ({
  createUser: vi.fn(),
  fetchUser: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, notificationAPI: notification }),
}));

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
  roles: [],
};
const renderForm = (entry = "/users#create", id?: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route
            path="/users"
            element={<UserForm id={id} onFinish={onFinish} />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(createUser).mockResolvedValue(user);
  vi.mocked(fetchUser).mockResolvedValue(user);
  vi.mocked(updateUser).mockResolvedValue(user);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("user drawer", () => {
  it("creates a user with active status and makes the generated password available", async () => {
    renderForm();
    const firstName = await screen.findByRole("textbox", {
      name: i18n.t("firstName"),
    });
    await waitFor(() => expect(document.activeElement).toBe(firstName));
    for (const [label, value] of [
      [i18n.t("firstName"), "Ada"],
      [i18n.t("lastName"), "Lovelace"],
      [i18n.t("mobile"), "09120000000"],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    const request = vi.mocked(createUser).mock.calls[0][0];

    expect(request).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      mobile: "09120000000",
      status: "active",
      password: expect.any(String),
    });
    expect(request.password.length).toBeGreaterThanOrEqual(12);
    expect(createUser).toHaveBeenCalledExactlyOnceWith(
      request,
      expect.any(AbortSignal),
    );
    expect(notification.success).toHaveBeenCalledWith({
      description: request.password,
      title: i18n.t("userCreated"),
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates a loaded profile without generating or submitting a password", async () => {
    renderForm("/users#update", "user-1");
    const firstName = await screen.findByDisplayValue("Ada");
    await waitFor(() => expect(document.activeElement).toBe(firstName));
    fireEvent.change(firstName, { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledExactlyOnceWith(
        "user-1",
        {
          firstName: "Grace",
          lastName: "Lovelace",
          mobile: "09120000000",
          status: "active",
        },
        expect.any(AbortSignal),
      ),
    );
    expect(notification.success).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });
});
