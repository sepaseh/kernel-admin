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

import { changePassword } from "@/features/auth";
import type { DefaultLayoutContext } from "@/layouts/default";
import { i18n } from "@/shared/i18n";
import "@/test/browser";
import { deferred } from "@/test/deferred";

import { AccountPage } from "./Account";
import { updateProfile } from "./api";

const { messages } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("./api", () => ({ updateProfile: vi.fn() }));
vi.mock("@/features/auth", () => ({ changePassword: vi.fn() }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, token: { marginMD: 16 } }),
}));

const currentUser: DefaultLayoutContext["currentUser"] = {
  id: "synthetic-account",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  isSystemAdmin: false,
  status: "active",
  permissions: [],
};
const fetchCurrentUser = vi.fn<DefaultLayoutContext["fetchCurrentUser"]>();
const clearSession = vi.fn();
const renderPage = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route
          element={
            <Outlet
              context={
                {
                  currentUser,
                  fetchCurrentUser,
                  clearSession,
                } satisfies DefaultLayoutContext
              }
            />
          }
        >
          <Route path="*" element={<AccountPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(updateProfile).mockResolvedValue(currentUser);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("account forms", () => {
  it("prefills the profile and waits for account refresh before reporting success", async () => {
    const pendingRefresh = deferred<void>();
    fetchCurrentUser.mockReturnValue(pendingRefresh.promise);
    renderPage();
    const firstName = screen.getByLabelText(
      i18n.t("firstName"),
    ) as HTMLInputElement;
    expect(firstName.value).toBe("Ada");
    fireEvent.change(firstName, { target: { value: "Grace" } });
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("saveProfile") }),
    );
    await waitFor(() => expect(fetchCurrentUser).toHaveBeenCalledTimes(1));
    expect(updateProfile).toHaveBeenCalledWith(
      { firstName: "Grace", lastName: "Lovelace" },
      expect.any(AbortSignal),
    );
    expect(messages.success).not.toHaveBeenCalled();

    await act(async () => {
      pendingRefresh.resolve();
    });

    expect(messages.success).toHaveBeenCalledWith(i18n.t("profileUpdated"));
  });

  it("ignores an accepted profile save after leaving the account page", async () => {
    const pendingSave = deferred<Awaited<ReturnType<typeof updateProfile>>>();
    vi.mocked(updateProfile).mockReturnValue(pendingSave.promise);
    const { unmount } = renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("saveProfile") }),
    );
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(updateProfile).mock.calls[0]?.[1];

    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      pendingSave.resolve(currentUser);
    });

    expect(fetchCurrentUser).not.toHaveBeenCalled();
    expect(messages.success).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("submits only password fields and clears the session after accepted change", async () => {
    renderPage();
    for (const [label, value] of [
      [i18n.t("currentPassword"), "synthetic-old"],
      [i18n.t("newPassword"), "synthetic-new"],
      [i18n.t("confirmPassword"), "synthetic-new"],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("changePassword") }),
    );

    await waitFor(() => expect(clearSession).toHaveBeenCalledTimes(1));
    expect(changePassword).toHaveBeenCalledExactlyOnceWith(
      { currentPassword: "synthetic-old", newPassword: "synthetic-new" },
      expect.any(AbortSignal),
    );
    expect(
      (screen.getByLabelText(i18n.t("currentPassword")) as HTMLInputElement)
        .value,
    ).toBe("");
    expect(messages.success).toHaveBeenCalledWith(i18n.t("passwordChanged"));
  });

  it("keeps the session and password fields after rejection and allows retry", async () => {
    const pendingChange = deferred<void>();
    vi.mocked(changePassword)
      .mockReturnValueOnce(pendingChange.promise)
      .mockResolvedValueOnce();
    renderPage();
    const fields = [
      [i18n.t("currentPassword"), "synthetic-old"],
      [i18n.t("newPassword"), "synthetic-new"],
      [i18n.t("confirmPassword"), "synthetic-new"],
    ] as const;
    for (const [label, value] of fields) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const submit = screen.getByRole("button", {
      name: i18n.t("changePassword"),
    });
    fireEvent.click(submit);

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    for (const [label] of fields) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(
        true,
      );
    }
    expect(messages.success).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();

    await act(async () => {
      pendingChange.reject(new Error("Synthetic password rejection"));
    });

    expect(messages.error).toHaveBeenCalledExactlyOnceWith(
      "Synthetic password rejection",
    );
    for (const [label, value] of fields) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.value).toBe(value);
      expect(input.disabled).toBe(false);
    }
    expect(messages.success).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();

    fireEvent.click(submit);

    await waitFor(() => expect(clearSession).toHaveBeenCalledTimes(1));
    expect(changePassword).toHaveBeenCalledTimes(2);
    expect(changePassword).toHaveBeenLastCalledWith(
      { currentPassword: "synthetic-old", newPassword: "synthetic-new" },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("passwordChanged"),
    );
    for (const [label] of fields) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    }
  });

  it("ignores an accepted password change after leaving the account page", async () => {
    const pendingChange = deferred<void>();
    vi.mocked(changePassword).mockReturnValue(pendingChange.promise);
    const { unmount } = renderPage();
    for (const [label, value] of [
      [i18n.t("currentPassword"), "synthetic-old"],
      [i18n.t("newPassword"), "synthetic-new"],
      [i18n.t("confirmPassword"), "synthetic-new"],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("changePassword") }),
    );
    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(changePassword).mock.calls[0]?.[1];

    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      pendingChange.resolve();
    });

    expect(clearSession).not.toHaveBeenCalled();
    expect(messages.success).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("keeps profile edits after a failed save without refreshing the account", async () => {
    vi.mocked(updateProfile).mockRejectedValue(
      new Error("Synthetic profile conflict"),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText(i18n.t("firstName")), {
      target: { value: "Grace" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("saveProfile") }),
    );

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Synthetic profile conflict"),
    );
    expect(fetchCurrentUser).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText(i18n.t("firstName")) as HTMLInputElement).value,
    ).toBe("Grace");
    expect(clearSession).not.toHaveBeenCalled();
  });
});
