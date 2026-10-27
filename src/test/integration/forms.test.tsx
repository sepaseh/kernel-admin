// @vitest-environment jsdom
import { act, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type * as ReactI18next from "react-i18next";
import { MemoryRouter, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as rolesApi from "@/features/roles/api";
import { RoleForm } from "@/features/roles/components/role-form/RoleForm";
import * as usersApi from "@/features/users/api";
import { UserForm } from "@/features/users/components/user-form/UserForm";
import { UserRoleForm } from "@/features/users/components/user-role-form/UserRoleForm";
import type { User } from "@/features/users/types";
import { clearAccessToken, setAccessToken } from "@/shared/api/token";
import { render, screen } from "@/test/render";

const mocks = vi.hoisted(() => ({
  goBack: vi.fn(),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  notificationSuccess: vi.fn(),
  currentUser: { id: "admin-1", isSystemAdmin: true, permissions: [] },
}));

vi.mock("@/features/roles/api", () => ({
  createRole: vi.fn(),
  updateRole: vi.fn(),
}));

vi.mock("@/features/users/api", () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  updateUserRoles: vi.fn(),
}));

const api = { ...rolesApi, ...usersApi };

vi.mock("@/app/hooks", () => ({
  useCore: () => ({ user: mocks.currentUser }),
  useAntd: () => ({
    messageAPI: {
      error: mocks.messageError,
      success: mocks.messageSuccess,
    },
    notificationAPI: { success: mocks.notificationSuccess },
  }),
}));

vi.mock("@/shared/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/hooks")>()),
  useGoBack: () => mocks.goBack,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactI18next>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const userData: User = {
  email: "ada@example.com",
  firstName: "Ada",
  id: "user-1",
  isSystemAdmin: false,
  lastName: "Lovelace",
  mobile: "09120000000",
  roles: [{ id: "role-1", name: "Operators" }],
  status: "active",
  username: "ada",
};
const renderAtHash = (ui: ReactNode, hash: string) =>
  render(<MemoryRouter initialEntries={[`/${hash}`]}>{ui}</MemoryRouter>);

const findFocusedField = async (name: string) => {
  const field = await screen.findByLabelText(name);
  await waitFor(() => expect(field).toHaveFocus());
  return field;
};

const LeaveCreateForm = () => {
  const navigate = useNavigate();
  return <button onClick={() => void navigate("/")}>Leave creation</button>;
};

const beginUserCreation = async (onFinish: () => void) => {
  const view = renderAtHash(
    <>
      <LeaveCreateForm />
      <UserForm onFinish={onFinish} />
    </>,
    "#create",
  );
  const clipboard = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue(undefined);
  await view.user.type(await findFocusedField("firstName"), "Ada");
  await view.user.type(screen.getByLabelText("lastName"), "Lovelace");
  await view.user.type(screen.getByLabelText("mobile"), "09120000000");
  await view.user.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(api.createUser).toHaveBeenCalledOnce());
  return { ...view, clipboard };
};

beforeEach(() => {
  mocks.currentUser.isSystemAdmin = true;
  clearAccessToken();
  vi.mocked(api.createRole)
    .mockReset()
    .mockResolvedValue({
      id: "role-1",
      name: "Operators",
      permissions: ["users.read"],
    });
  vi.mocked(api.createUser).mockReset().mockResolvedValue(userData);
  vi.mocked(api.updateRole)
    .mockReset()
    .mockResolvedValue({
      id: "role-1",
      name: "Operators",
      permissions: ["users.read"],
    });
  vi.mocked(api.updateUser).mockReset().mockResolvedValue(userData);
  vi.mocked(api.updateUserRoles).mockReset().mockResolvedValue(undefined);
});

describe("user identity form", () => {
  it("validates and creates a user", async () => {
    const onFinish = vi.fn();
    const { user } = renderAtHash(<UserForm onFinish={onFinish} />, "#create");

    await user.type(await findFocusedField("firstName"), "Ada");
    await user.type(screen.getByLabelText("lastName"), "Lovelace");
    await user.type(screen.getByLabelText("mobile"), "09120000000");
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(api.createUser).toHaveBeenCalledOnce());
    const password = vi.mocked(api.createUser).mock.calls[0][0].password;
    expect(password).toMatch(/^[a-z0-9]{16}$/);
    expect(api.createUser).toHaveBeenCalledWith(
      {
        firstName: "Ada",
        lastName: "Lovelace",
        mobile: "09120000000",
        password,
      },
      expect.any(AbortSignal),
    );
    expect(mocks.notificationSuccess).toHaveBeenCalledWith({
      description: password,
      message: "password",
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith("userCreated");
    expect(mocks.goBack).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
  }, 10_000);

  it("requires the user identity fields before generating a password", async () => {
    const { user } = renderAtHash(<UserForm onFinish={vi.fn()} />, "#create");

    await findFocusedField("firstName");
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(screen.getAllByText(/required/i)).toHaveLength(3),
    );
    expect(api.createUser).not.toHaveBeenCalled();
    expect(mocks.notificationSuccess).not.toHaveBeenCalled();
  });

  it("updates a user without generating a new password", async () => {
    const onFinish = vi.fn();
    const { user } = renderAtHash(
      <UserForm data={userData} onFinish={onFinish} />,
      "#update",
    );

    const firstName = await findFocusedField("firstName");
    await user.clear(firstName);
    await user.type(firstName, "Augusta");
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(api.updateUser).toHaveBeenCalledWith(
        "user-1",
        {
          firstName: "Augusta",
          lastName: "Lovelace",
          mobile: "09120000000",
        },
        expect.any(AbortSignal),
      ),
    );
    expect(mocks.notificationSuccess).not.toHaveBeenCalled();
    expect(mocks.messageSuccess).toHaveBeenCalledWith("userUpdated");
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("keeps the user form open and reports creation failures", async () => {
    vi.mocked(api.createUser).mockRejectedValueOnce(
      new Error("Mobile already exists"),
    );
    const onFinish = vi.fn();
    const { user } = renderAtHash(<UserForm onFinish={onFinish} />, "#create");

    await user.type(await findFocusedField("firstName"), "Ada");
    await user.type(screen.getByLabelText("lastName"), "Lovelace");
    await user.type(screen.getByLabelText("mobile"), "09120000000");
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(mocks.messageError).toHaveBeenCalledWith("Mobile already exists"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.notificationSuccess).not.toHaveBeenCalled();
    expect(mocks.goBack).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});

describe("generated creation credentials", () => {
  it.each(["unmount", "route"] as const)(
    "reveals an acknowledged creation password after %s without stale form effects",
    async (change) => {
      let release!: () => void;
      vi.mocked(api.createUser).mockReturnValueOnce(
        new Promise((resolve) => {
          release = () => resolve(userData);
        }),
      );
      const onFinish = vi.fn();
      const view = await beginUserCreation(onFinish);
      const password = vi.mocked(api.createUser).mock.calls[0][0].password;
      if (change === "unmount") view.unmount();
      else
        await act(async () => {
          fireEvent.click(
            screen.getByRole("button", {
              name: "Leave creation",
              hidden: true,
            }),
          );
        });
      expect(vi.mocked(api.createUser).mock.calls[0][1]?.aborted).toBe(true);
      await act(async () => release());
      expect(mocks.notificationSuccess).toHaveBeenCalledExactlyOnceWith({
        description: password,
        message: "password",
      });
      expect(view.clipboard).toHaveBeenCalledExactlyOnceWith(password);
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
      expect(mocks.messageError).not.toHaveBeenCalled();
      expect(mocks.goBack).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
    },
  );

  it.each(["login", "logout"] as const)(
    "does not reveal creation credentials after %s changes the session",
    async (change) => {
      let release!: () => void;
      vi.mocked(api.createUser).mockReturnValueOnce(
        new Promise((resolve) => {
          release = () => resolve(userData);
        }),
      );
      const onFinish = vi.fn();
      const view = await beginUserCreation(onFinish);
      act(() => {
        if (change === "login") setAccessToken("synthetic-new-login");
        else clearAccessToken();
      });
      await act(async () => release());
      expect(mocks.notificationSuccess).not.toHaveBeenCalled();
      expect(view.clipboard).not.toHaveBeenCalled();
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
      expect(mocks.messageError).not.toHaveBeenCalled();
      expect(mocks.goBack).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
    },
  );

  it("does not claim or reveal creation credentials when the canceled request rejects", async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(api.createUser).mockReturnValueOnce(
      new Promise((_, rejectRequest) => {
        reject = rejectRequest;
      }),
    );
    const onFinish = vi.fn();
    const view = await beginUserCreation(onFinish);
    await view.user.keyboard("{Escape}");
    expect(vi.mocked(api.createUser).mock.calls[0][1]?.aborted).toBe(true);
    expect(mocks.goBack).toHaveBeenCalledOnce();
    await act(async () =>
      reject(new Error("Synthetic response was not acknowledged")),
    );
    expect(mocks.notificationSuccess).not.toHaveBeenCalled();
    expect(view.clipboard).not.toHaveBeenCalled();
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.messageError).not.toHaveBeenCalled();
    expect(mocks.goBack).toHaveBeenCalledOnce();
    expect(onFinish).not.toHaveBeenCalled();
  });
});

describe("role form", () => {
  it("creates a role with selected permissions and reports failures", async () => {
    vi.mocked(api.createRole).mockRejectedValueOnce(
      new Error("Role already exists"),
    );
    const { user } = renderAtHash(
      <RoleForm
        onFinish={vi.fn()}
        options={{
          permissions: [
            {
              name: "users",
              permissions: [{ name: "users.read", title: "Read users" }],
              title: "Users",
            },
          ],
        }}
      />,
      "#create",
    );

    await user.type(await findFocusedField("name"), "Operators");
    await user.click(screen.getByLabelText("Read users"));
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(api.createRole).toHaveBeenCalledWith(
        {
          name: "Operators",
          permissions: ["users.read"],
        },
        expect.any(AbortSignal),
      ),
    );
    expect(mocks.messageError).toHaveBeenCalledWith("Role already exists");
  });

  it("prefills and updates an existing role", async () => {
    const onFinish = vi.fn();
    const { user } = renderAtHash(
      <RoleForm
        data={{
          id: "role-1",
          name: "Operators",
          permissions: ["users.read"],
        }}
        onFinish={onFinish}
        options={{
          permissions: [
            {
              name: "users",
              permissions: [{ name: "users.read", title: "Read users" }],
              title: "Users",
            },
          ],
        }}
      />,
      "#update",
    );

    const name = await findFocusedField("name");
    expect(name).toHaveValue("Operators");
    expect(screen.getByLabelText("Read users")).toBeChecked();
    await user.clear(name);
    await user.type(name, "Administrators");
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith(
        "role-1",
        {
          name: "Administrators",
          permissions: ["users.read"],
        },
        expect.any(AbortSignal),
      ),
    );
    expect(mocks.messageSuccess).toHaveBeenCalledWith("roleUpdated");
    expect(mocks.goBack).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
  });
});

describe("user access forms", () => {
  it("submits the user's current roles", async () => {
    const onFinish = vi.fn();
    const { user } = renderAtHash(
      <UserRoleForm
        data={userData}
        onFinish={onFinish}
        options={{
          roles: [{ id: "role-1", name: "Operators", permissions: [] }],
        }}
      />,
      "#roles",
    );

    await screen.findByText("Operators");
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(api.updateUserRoles).toHaveBeenCalledWith(
        "user-1",
        {
          roleIds: ["role-1"],
        },
        expect.any(AbortSignal),
      ),
    );
    expect(mocks.messageSuccess).toHaveBeenCalledWith("rolesUpdated");
    expect(onFinish).toHaveBeenCalledOnce();
  });
});

describe("form data guards", () => {
  it.each([
    {
      hash: "#update",
      name: "user",
      ui: <UserForm onFinish={vi.fn()} />,
    },
    {
      hash: "#update",
      name: "role",
      ui: <RoleForm onFinish={vi.fn()} options={{ permissions: [] }} />,
    },
    {
      hash: "#roles",
      name: "roles",
      ui: <UserRoleForm onFinish={vi.fn()} options={{ roles: [] }} />,
    },
  ])(
    "closes the $name form when its record is missing",
    async ({ hash, ui }) => {
      renderAtHash(ui, hash);

      await waitFor(() => expect(mocks.goBack).toHaveBeenCalledOnce());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
});

describe("form cancellation", () => {
  it.each([
    {
      hash: "#create",
      name: "user",
      ui: <UserForm onFinish={vi.fn()} />,
    },
    {
      hash: "#create",
      name: "role",
      ui: <RoleForm onFinish={vi.fn()} options={{ permissions: [] }} />,
    },
    {
      hash: "#roles",
      name: "roles",
      ui: (
        <UserRoleForm
          data={userData}
          onFinish={vi.fn()}
          options={{ roles: [] }}
        />
      ),
    },
  ])(
    "closes the $name form without forwarding the event",
    async ({ hash, ui }) => {
      const { user } = renderAtHash(ui, hash);

      await user.click(await screen.findByRole("button", { name: "cancel" }));

      expect(mocks.goBack).toHaveBeenLastCalledWith();
    },
  );
});

describe("permission and mutation ownership", () => {
  const mutationForms = ["user", "role", "user roles"] as const;
  type MutationForm = (typeof mutationForms)[number];
  const formFor = (
    kind: MutationForm,
    id: User["id"],
    onFinish: () => void,
  ) => {
    if (kind === "user")
      return <UserForm data={{ ...userData, id }} onFinish={onFinish} />;
    if (kind === "role")
      return (
        <RoleForm
          data={{ id, name: "Operators", permissions: ["users.read"] }}
          onFinish={onFinish}
          options={{ permissions: [] }}
        />
      );
    return (
      <UserRoleForm
        data={{ ...userData, id }}
        onFinish={onFinish}
        options={{
          roles: [{ id: "role-1", name: "Operators", permissions: [] }],
        }}
      />
    );
  };
  const hashFor = (kind: MutationForm) =>
    kind === "user roles" ? "#roles" : "#update";
  const LeaveForm = () => {
    const navigate = useNavigate();
    return <button onClick={() => void navigate("/")}>Leave form</button>;
  };
  const holdMutation = (kind: MutationForm) => {
    let release!: () => void;
    if (kind === "user")
      vi.mocked(api.updateUser).mockReturnValueOnce(
        new Promise((resolve) => {
          release = () => resolve(userData);
        }),
      );
    else if (kind === "role")
      vi.mocked(api.updateRole).mockReturnValueOnce(
        new Promise((resolve) => {
          release = () =>
            resolve({ id: "record-1", name: "Operators", permissions: [] });
        }),
      );
    else
      vi.mocked(api.updateUserRoles).mockReturnValueOnce(
        new Promise((resolve) => {
          release = () => resolve(undefined);
        }),
      );
    return {
      release: () => release(),
      operation:
        kind === "user"
          ? api.updateUser
          : kind === "role"
            ? api.updateRole
            : api.updateUserRoles,
    };
  };

  it.each(["user", "role"] as const)(
    "rejects direct create hashes without %s creation permission",
    async (kind) => {
      mocks.currentUser.isSystemAdmin = false;
      const ui =
        kind === "user" ? (
          <UserForm onFinish={vi.fn()} />
        ) : (
          <RoleForm onFinish={vi.fn()} options={{ permissions: [] }} />
        );
      renderAtHash(ui, "#create");
      await waitFor(() => expect(mocks.goBack).toHaveBeenCalledOnce());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(api.createUser).not.toHaveBeenCalled();
      expect(api.createRole).not.toHaveBeenCalled();
    },
  );

  it.each(mutationForms)(
    "rejects direct %s edit hashes without update permission",
    async (kind) => {
      mocks.currentUser.isSystemAdmin = false;
      renderAtHash(formFor(kind, "record-1", vi.fn()), hashFor(kind));
      await waitFor(() => expect(mocks.goBack).toHaveBeenCalledOnce());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(api.updateUser).not.toHaveBeenCalled();
      expect(api.updateRole).not.toHaveBeenCalled();
      expect(api.updateUserRoles).not.toHaveBeenCalled();
    },
  );

  it.each(mutationForms)(
    "does not navigate or notify after a pending %s form unmounts",
    async (kind) => {
      const pending = holdMutation(kind);
      const onFinish = vi.fn();
      const { user, unmount } = renderAtHash(
        formFor(kind, "record-1", onFinish),
        hashFor(kind),
      );
      await user.click(await screen.findByRole("button", { name: "submit" }));
      await waitFor(() => expect(pending.operation).toHaveBeenCalledOnce());
      const signal = vi.mocked(pending.operation).mock.calls[0][2];
      unmount();
      expect(signal?.aborted).toBe(true);
      await act(async () => pending.release());
      expect(mocks.goBack).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
      expect(mocks.messageError).not.toHaveBeenCalled();
    },
  );

  it.each(mutationForms)(
    "invalidates a pending %s operation immediately when Escape closes its drawer",
    async (kind) => {
      const pending = holdMutation(kind);
      const onFinish = vi.fn();
      const { user } = renderAtHash(
        formFor(kind, "record-1", onFinish),
        hashFor(kind),
      );
      await user.click(await screen.findByRole("button", { name: "submit" }));
      await waitFor(() => expect(pending.operation).toHaveBeenCalledOnce());
      await user.keyboard("{Escape}");
      expect(vi.mocked(pending.operation).mock.calls[0][2]?.aborted).toBe(true);
      expect(mocks.goBack).toHaveBeenCalledOnce();
      await act(async () => pending.release());
      expect(onFinish).not.toHaveBeenCalled();
      expect(mocks.goBack).toHaveBeenCalledOnce();
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
    },
  );

  it.each(mutationForms)(
    "invalidates a pending %s operation when its drawer route closes",
    async (kind) => {
      const pending = holdMutation(kind);
      const onFinish = vi.fn();
      const { user } = renderAtHash(
        <>
          <LeaveForm />
          {formFor(kind, "record-1", onFinish)}
        </>,
        hashFor(kind),
      );
      await user.click(await screen.findByRole("button", { name: "submit" }));
      await waitFor(() => expect(pending.operation).toHaveBeenCalledOnce());
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Leave form", hidden: true }),
        );
      });
      expect(vi.mocked(pending.operation).mock.calls[0][2]?.aborted).toBe(true);
      await act(async () => pending.release());
      expect(onFinish).not.toHaveBeenCalled();
      expect(mocks.goBack).not.toHaveBeenCalled();
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
    },
  );

  it.each(mutationForms)(
    "invalidates a pending %s operation when update permission is revoked",
    async (kind) => {
      const pending = holdMutation(kind);
      const onFinish = vi.fn();
      const hash = hashFor(kind);
      const ui = formFor(kind, "record-1", onFinish);
      const { user, rerender } = renderAtHash(ui, hash);
      await user.click(await screen.findByRole("button", { name: "submit" }));
      await waitFor(() => expect(pending.operation).toHaveBeenCalledOnce());
      mocks.currentUser.isSystemAdmin = false;
      rerender(
        <MemoryRouter initialEntries={[`/${hash}`]}>
          {formFor(kind, "record-1", onFinish)}
        </MemoryRouter>,
      );
      expect(vi.mocked(pending.operation).mock.calls[0][2]?.aborted).toBe(true);
      await waitFor(() => expect(mocks.goBack).toHaveBeenCalledOnce());
      await act(async () => pending.release());
      expect(onFinish).not.toHaveBeenCalled();
      expect(mocks.goBack).toHaveBeenCalledOnce();
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
    },
  );

  it.each(mutationForms)(
    "does not apply a pending %s completion to a different record",
    async (kind) => {
      const pending = holdMutation(kind);
      const onFinish = vi.fn();
      const hash = hashFor(kind);
      const { user, rerender } = renderAtHash(
        formFor(kind, "record-1", onFinish),
        hash,
      );
      await user.click(await screen.findByRole("button", { name: "submit" }));
      await waitFor(() => expect(pending.operation).toHaveBeenCalledOnce());
      rerender(
        <MemoryRouter initialEntries={[`/${hash}`]}>
          {formFor(kind, "record-2", onFinish)}
        </MemoryRouter>,
      );
      expect(vi.mocked(pending.operation).mock.calls[0][2]?.aborted).toBe(true);
      await act(async () => pending.release());
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(onFinish).not.toHaveBeenCalled();
      expect(mocks.goBack).not.toHaveBeenCalled();
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
    },
  );

  it.each(mutationForms)(
    "does not apply a pending %s completion after another login",
    async (kind) => {
      const pending = holdMutation(kind);
      const onFinish = vi.fn();
      const { user } = renderAtHash(
        formFor(kind, "record-1", onFinish),
        hashFor(kind),
      );
      await user.click(await screen.findByRole("button", { name: "submit" }));
      await waitFor(() => expect(pending.operation).toHaveBeenCalledOnce());
      setAccessToken("synthetic-new-login");
      await act(async () => pending.release());
      expect(onFinish).not.toHaveBeenCalled();
      expect(mocks.goBack).not.toHaveBeenCalled();
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
    },
  );

  it.each(mutationForms)(
    "deduplicates a second native %s submission while pending",
    async (kind) => {
      const pending = holdMutation(kind);
      const { user } = renderAtHash(
        formFor(kind, "record-1", vi.fn()),
        hashFor(kind),
      );
      await user.click(await screen.findByRole("button", { name: "submit" }));
      await waitFor(() => expect(pending.operation).toHaveBeenCalledOnce());
      const form = screen.getByRole("dialog").querySelector("form");
      expect(form).not.toBeNull();
      await act(async () => {
        fireEvent.submit(form!);
        fireEvent.submit(form!);
      });
      expect(pending.operation).toHaveBeenCalledOnce();
      await act(async () => pending.release());
      expect(pending.operation).toHaveBeenCalledOnce();
    },
  );
});
