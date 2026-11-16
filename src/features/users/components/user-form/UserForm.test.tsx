// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { clearAccessToken, setAccessToken } from "@/shared/api/token";
import { i18n } from "@/shared/i18n";
import type * as FormDrawerModule from "@/shared/ui/form-drawer";
import { deferred } from "@/test/deferred";

import { createUser, fetchUser, updateUser } from "../../api";
import type { User } from "../../types";
import { UserForm } from "./UserForm";

const { clipboard, drawerOpenChange, messages, notification, onFinish } =
  vi.hoisted(() => ({
    clipboard: vi.fn(),
    drawerOpenChange: vi.fn(),
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
vi.mock("@/shared/ui/form-drawer", async (importOriginal) => {
  const { FormDrawer } = await importOriginal<typeof FormDrawerModule>();

  return {
    FormDrawer: (props: ComponentProps<typeof FormDrawer>) => (
      <FormDrawer
        {...props}
        afterOpenChange={(open) => {
          props.afterOpenChange?.(open);
          drawerOpenChange(open);
        }}
      />
    ),
  };
});

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
const FormLocation = () => {
  const { hash } = useLocation();
  return <output aria-label="User form hash">{hash}</output>;
};
const renderForm = (entry = "/users#create", id?: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <FormLocation />
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
  clearAccessToken();
  clipboard.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboard },
  });
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
    expect(firstName).toHaveValue("");
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

  it("shows user details and enables saving after they arrive in an already opened drawer", async () => {
    const pendingUser = deferred<User>();
    vi.mocked(fetchUser).mockReturnValueOnce(pendingUser.promise);
    renderForm("/users#update", "user-1");
    await waitFor(() => expect(drawerOpenChange).toHaveBeenCalledWith(true));
    expect(
      screen.queryByRole("textbox", { name: i18n.t("firstName") }),
    ).toBeNull();
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: i18n.t("submit"),
    });
    expect(submit).toBeDisabled();

    await act(async () => {
      pendingUser.resolve(user);
    });

    const firstName = screen.getByRole("textbox", {
      name: i18n.t("firstName"),
    });
    expect(firstName).toHaveValue("Ada");
    expect(submit).toBeEnabled();
  });

  it("keeps acknowledged credentials available when clipboard access fails", async () => {
    clipboard.mockRejectedValueOnce(new Error("Synthetic clipboard denial"));
    renderForm();
    for (const [field, value] of [
      ["firstName", "Ada"],
      ["lastName", "Lovelace"],
      ["mobile", "09120000000"],
    ] as const) {
      fireEvent.change(await screen.findByLabelText(i18n.t(field)), {
        target: { value },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    const { password } = vi.mocked(createUser).mock.calls[0][0];
    expect(notification.success).toHaveBeenCalledExactlyOnceWith({
      description: password,
      title: i18n.t("userCreated"),
    });
    expect(clipboard).toHaveBeenCalledExactlyOnceWith(password);
    expect(messages.error).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText("User form hash").textContent).toBe(""),
    );
  });

  it.each(["login", "logout"] as const)(
    "does not finish or navigate after %s changes the session during clipboard access",
    async (change) => {
      const pendingClipboard = deferred<void>();
      clipboard.mockReturnValueOnce(pendingClipboard.promise);
      renderForm();
      for (const [field, value] of [
        ["firstName", "Ada"],
        ["lastName", "Lovelace"],
        ["mobile", "09120000000"],
      ] as const) {
        fireEvent.change(await screen.findByLabelText(i18n.t(field)), {
          target: { value },
        });
      }
      const submit = screen.getByRole("button", { name: i18n.t("submit") });
      fireEvent.click(submit);
      await waitFor(() => expect(clipboard).toHaveBeenCalledOnce());
      const { password } = vi.mocked(createUser).mock.calls[0][0];
      expect(notification.success).toHaveBeenCalledExactlyOnceWith({
        description: password,
        title: i18n.t("userCreated"),
      });

      act(() => {
        if (change === "login") setAccessToken("synthetic-new-login");
        else clearAccessToken();
      });
      await act(async () => pendingClipboard.resolve());

      expect(onFinish).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
      await waitFor(() => expect(submit).toBeEnabled());
      expect(screen.getByLabelText("User form hash")).toHaveTextContent(
        "#create",
      );
      expect(notification.success).toHaveBeenCalledOnce();
      expect(clipboard).toHaveBeenCalledExactlyOnceWith(password);
    },
  );

  it.each(["create", "update"] as const)(
    "retains edits after a rejected %s and allows a successful retry",
    async (action) => {
      const pending = deferred<User>();
      const save =
        action === "create" ? vi.mocked(createUser) : vi.mocked(updateUser);
      save.mockReturnValueOnce(pending.promise);
      renderForm(
        `/users#${action}`,
        action === "update" ? "user-1" : undefined,
      );
      const firstName =
        action === "update"
          ? await screen.findByDisplayValue<HTMLInputElement>("Ada")
          : await screen.findByRole<HTMLInputElement>("textbox", {
              name: i18n.t("firstName"),
            });
      await waitFor(() => expect(firstName.disabled).toBe(false));
      const values = {
        firstName: "Grace",
        lastName: "Hopper",
        mobile: "09120000042",
      };
      const fields = ["firstName", "lastName", "mobile"] as const;
      for (const field of fields) {
        fireEvent.change(screen.getByLabelText(i18n.t(field)), {
          target: { value: values[field] },
        });
      }
      const submit = screen.getByRole<HTMLButtonElement>("button", {
        name: i18n.t("submit"),
      });
      fireEvent.click(submit);
      await waitFor(() => {
        expect(save).toHaveBeenCalledTimes(1);
        expect(submit.disabled).toBe(true);
      });
      expect(firstName.disabled).toBe(true);

      await act(async () => {
        pending.reject(new Error("Synthetic user save rejected"));
      });

      await waitFor(() => expect(submit.disabled).toBe(false));
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Synthetic user save rejected",
      );
      expect(screen.getByRole("dialog")).toBeDefined();
      for (const field of fields) {
        expect(
          screen.getByLabelText<HTMLInputElement>(i18n.t(field)).value,
        ).toBe(values[field]);
      }
      expect(firstName.disabled).toBe(false);
      expect(onFinish).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
      expect(notification.success).not.toHaveBeenCalled();

      fireEvent.click(submit);

      await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
      expect(save).toHaveBeenCalledTimes(2);
      const savedValues =
        action === "create"
          ? vi.mocked(createUser).mock.calls[1][0]
          : vi.mocked(updateUser).mock.calls[1][1];
      expect(savedValues).toMatchObject({ ...values, status: "active" });
    },
  );
});
