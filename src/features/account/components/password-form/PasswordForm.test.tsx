// @vitest-environment jsdom
import { act, fireEvent, waitFor } from "@testing-library/react";
import { CanceledError } from "axios";
import { useState } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword } from "@/features/auth";
import type { DefaultLayoutContext } from "@/layouts/default";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/shared/api";
import { i18nInstance } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import type { CurrentUser } from "../../types";
import { PasswordForm } from "./PasswordForm";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/features/auth", () => ({ changePassword: vi.fn() }));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));

const account: CurrentUser = {
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
const DefaultCurrentUserOutlet = () => {
  const [currentUser, setCurrentUser] = useState(account);
  return (
    <>
      <button
        onClick={() => {
          setAccessToken("newer-session");
          setCurrentUser({ ...account, id: "account-2" });
        }}
        type="button"
      >
        New session
      </button>
      <Outlet
        context={
          {
            clearSession,
            currentUser,
            fetchCurrentUser,
          } satisfies DefaultLayoutContext
        }
      />
    </>
  );
};
const Harness = () => (
  <MemoryRouter>
    <Routes>
      <Route element={<DefaultCurrentUserOutlet />}>
        <Route element={<PasswordForm />} path="*" />
      </Route>
    </Routes>
  </MemoryRouter>
);
const submit = () =>
  screen.getByRole("button", { name: i18nInstance.t("changePassword") });
const fillPassword = async (user: ReturnType<typeof render>["user"]) => {
  await user.type(
    screen.getByLabelText(i18nInstance.t("currentPassword")),
    "old-secret",
  );
  await user.type(
    screen.getByLabelText(i18nInstance.t("newPassword")),
    "new-secret",
  );
  await user.type(
    screen.getByLabelText(i18nInstance.t("confirmPassword")),
    "new-secret",
  );
};

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
  setAccessToken("synthetic-session");
  vi.mocked(changePassword).mockReset().mockResolvedValue(undefined);
  clearSession.mockReset().mockImplementation(() => clearAccessToken());
  fetchCurrentUser.mockReset().mockResolvedValue(undefined);
});
afterEach(() => clearAccessToken());

describe("PasswordForm", () => {
  it("focuses the current password and keeps required validation inline", async () => {
    const { user } = render(<Harness />);
    const currentPassword = screen.getByLabelText(
      i18nInstance.t("currentPassword"),
    );
    expect(currentPassword).toHaveFocus();
    await user.click(submit());
    await waitFor(() =>
      expect(currentPassword).toHaveAttribute("aria-invalid", "true"),
    );
    expect(changePassword).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation before sending the password contract", async () => {
    const { user } = render(<Harness />);
    await fillPassword(user);
    const confirmation = screen.getByLabelText(
      i18nInstance.t("confirmPassword"),
    );
    await user.clear(confirmation);
    await user.type(confirmation, "different-secret");
    await user.click(submit());
    await screen.findByText(i18nInstance.t("passwordMismatch"));
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("changes the password, clears its fields and ends the current session", async () => {
    const { user } = render(<Harness />);
    await fillPassword(user);
    await user.click(submit());
    await waitFor(() => expect(clearSession).toHaveBeenCalledOnce());
    expect(changePassword).toHaveBeenCalledWith(
      { currentPassword: "old-secret", newPassword: "new-secret" },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledWith(
      i18nInstance.t("passwordChanged"),
    );
    expect(
      screen.getByLabelText(i18nInstance.t("currentPassword")),
    ).toHaveValue("");
    expect(screen.getByLabelText(i18nInstance.t("newPassword"))).toHaveValue(
      "",
    );
    expect(
      screen.getByLabelText(i18nInstance.t("confirmPassword")),
    ).toHaveValue("");
    expect(getAccessToken()).toBeNull();
  });

  it("reserves one submission while the password request is pending", async () => {
    const pending = deferred<void>();
    vi.mocked(changePassword).mockReturnValueOnce(pending.promise);
    const { user } = render(<Harness />);
    await fillPassword(user);
    const form = submit().closest("form");
    if (!form) throw new Error("Password form is missing");
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    await waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
    expect(
      screen.getByLabelText(i18nInstance.t("currentPassword")),
    ).toBeDisabled();
    await act(async () => pending.resolve(undefined));
    expect(clearSession).toHaveBeenCalledOnce();
  });

  it("retains input after a failed request and allows retry", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(
      new Error("Password unavailable"),
    );
    const { user } = render(<Harness />);
    await fillPassword(user);
    await user.click(submit());
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Password unavailable"),
    );
    expect(screen.getByLabelText(i18nInstance.t("newPassword"))).toHaveValue(
      "new-secret",
    );
    expect(clearSession).not.toHaveBeenCalled();
    await user.click(submit());
    await waitFor(() => expect(clearSession).toHaveBeenCalledOnce());
    expect(changePassword).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"] as const)(
    "cancels on unmount and ignores a late %s",
    async (settlement) => {
      const pending = deferred<void>();
      vi.mocked(changePassword).mockReturnValueOnce(pending.promise);
      const { unmount, user } = render(<Harness />);
      await fillPassword(user);
      await user.click(submit());
      await waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
      unmount();
      expect(vi.mocked(changePassword).mock.calls[0][1]?.aborted).toBe(true);
      await act(async () => {
        if (settlement === "resolve") pending.resolve(undefined);
        else pending.reject(new Error("Obsolete failure"));
      });
      expect(messages.error).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
      expect(clearSession).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("synthetic-session");
    },
  );

  it.each(["resolve", "reject"] as const)(
    "preserves a newer login after an old password request %s",
    async (settlement) => {
      const pending = deferred<void>();
      vi.mocked(changePassword).mockReturnValueOnce(pending.promise);
      const { user } = render(<Harness />);
      await fillPassword(user);
      const button = submit();
      await user.click(button);
      await waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
      await user.click(screen.getByRole("button", { name: "New session" }));
      await act(async () => {
        if (settlement === "resolve") pending.resolve(undefined);
        else pending.reject(new Error("Old session failure"));
      });
      expect(getAccessToken()).toBe("newer-session");
      expect(clearSession).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
      expect(
        screen.getByLabelText(i18nInstance.t("currentPassword")),
      ).toHaveValue("");
      await fillPassword(user);
      await waitFor(() => expect(button).toBeEnabled());
      await user.click(button);
      await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(2));
    },
  );

  it("ignores a rejected password change when login changes before its direct catch", async () => {
    const pending = deferred<void>();
    vi.mocked(changePassword).mockReturnValueOnce(pending.promise);
    const { user } = render(<Harness />);
    await fillPassword(user);
    await user.click(submit());
    await waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
    await act(async () => {
      pending.reject(new Error("Old session failure"));
      setAccessToken("newer-session");
    });
    expect(getAccessToken()).toBe("newer-session");
    expect(messages.error).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("suppresses cancellation errors and releases the form for retry", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(
      new CanceledError("Cancelled"),
    );
    const { user } = render(<Harness />);
    await fillPassword(user);
    await user.click(submit());
    await waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
    await waitFor(() => expect(submit()).toBeEnabled());
    expect(messages.error).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
    await user.click(submit());
    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(2));
  });
});
