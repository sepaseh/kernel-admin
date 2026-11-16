// @vitest-environment jsdom
import { act, fireEvent, waitFor } from "@testing-library/react";
import { CanceledError } from "axios";
import { useState } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DefaultLayoutContext } from "@/layouts/default";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/shared/api";
import { profileNameMaxLength } from "@/shared/contracts";
import { i18nInstance } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import { updateProfile } from "../../api";
import type { CurrentUser } from "../../types";
import { ProfileForm } from "./ProfileForm";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("../../api", () => ({ updateProfile: vi.fn() }));
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
          setCurrentUser({ ...account, id: "account-2", firstName: "Grace" });
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
        <Route element={<ProfileForm />} path="*" />
      </Route>
    </Routes>
  </MemoryRouter>
);
const submit = () =>
  screen.getByRole("button", { name: i18nInstance.t("saveProfile") });

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
  setAccessToken("synthetic-session");
  vi.mocked(updateProfile).mockReset().mockResolvedValue(account);
  fetchCurrentUser.mockReset().mockResolvedValue(undefined);
});
afterEach(() => clearAccessToken());

describe("ProfileForm", () => {
  it("loads the current names, focuses the first field and preserves the profile length limit", () => {
    render(<Harness />);
    const firstName = screen.getByLabelText(i18nInstance.t("firstName"));
    expect(firstName).toHaveValue("Ada");
    expect(firstName).toHaveFocus();
    expect(firstName).toHaveAttribute(
      "maxlength",
      String(profileNameMaxLength),
    );
    expect(screen.getByLabelText(i18nInstance.t("lastName"))).toHaveAttribute(
      "maxlength",
      String(profileNameMaxLength),
    );
  });

  it("keeps required-field validation inline without sending a request", async () => {
    const { user } = render(<Harness />);
    const firstName = screen.getByLabelText(i18nInstance.t("firstName"));
    await user.clear(firstName);
    await user.click(submit());
    await waitFor(() =>
      expect(firstName).toHaveAttribute("aria-invalid", "true"),
    );
    expect(updateProfile).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("validates profile names beyond the shared limit before sending a request", async () => {
    const { user } = render(<Harness />);
    const firstName = screen.getByLabelText(i18nInstance.t("firstName"));
    fireEvent.change(firstName, {
      target: { value: "A".repeat(profileNameMaxLength + 1) },
    });
    await user.click(submit());
    await waitFor(() =>
      expect(firstName).toHaveAttribute("aria-invalid", "true"),
    );
    expect(updateProfile).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("saves only the profile contract and refreshes the accepted current user", async () => {
    const { user } = render(<Harness />);
    const firstName = screen.getByLabelText(i18nInstance.t("firstName"));
    await user.clear(firstName);
    await user.type(firstName, "Augusta");
    await user.click(submit());
    await waitFor(() =>
      expect(messages.success).toHaveBeenCalledWith(
        i18nInstance.t("profileUpdated"),
      ),
    );
    expect(updateProfile).toHaveBeenCalledWith(
      { firstName: "Augusta", lastName: "Lovelace" },
      expect.any(AbortSignal),
    );
    expect(fetchCurrentUser).toHaveBeenCalledOnce();
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("reports a successful PATCH even when the following current-user refresh fails", async () => {
    fetchCurrentUser.mockRejectedValueOnce(new Error("Refresh unavailable"));
    const { user } = render(<Harness />);
    await user.click(submit());
    await waitFor(() =>
      expect(messages.success).toHaveBeenCalledWith(
        i18nInstance.t("profileUpdated"),
      ),
    );
    expect(updateProfile).toHaveBeenCalledOnce();
    expect(fetchCurrentUser).toHaveBeenCalledOnce();
    expect(messages.error).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });

  it("reserves one submission while the profile request is pending", async () => {
    const pending = deferred<CurrentUser>();
    vi.mocked(updateProfile).mockReturnValueOnce(pending.promise);
    render(<Harness />);
    const button = submit();
    const form = button.closest("form");
    if (!form) throw new Error("Profile form is missing");
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
    expect(screen.getByLabelText(i18nInstance.t("firstName"))).toBeDisabled();
    await act(async () => pending.resolve(account));
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("preserves edited names after failure and allows a retry", async () => {
    vi.mocked(updateProfile).mockRejectedValueOnce(
      new Error("Profile unavailable"),
    );
    const { user } = render(<Harness />);
    const firstName = screen.getByLabelText(i18nInstance.t("firstName"));
    await user.clear(firstName);
    await user.type(firstName, "Augusta");
    await user.click(submit());
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Profile unavailable"),
    );
    expect(firstName).toHaveValue("Augusta");
    expect(fetchCurrentUser).not.toHaveBeenCalled();
    await user.click(submit());
    await waitFor(() =>
      expect(messages.success).toHaveBeenCalledWith(
        i18nInstance.t("profileUpdated"),
      ),
    );
    expect(updateProfile).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"] as const)(
    "cancels on unmount and ignores a late %s",
    async (settlement) => {
      const pending = deferred<CurrentUser>();
      vi.mocked(updateProfile).mockReturnValueOnce(pending.promise);
      const { unmount, user } = render(<Harness />);
      await user.click(submit());
      await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
      unmount();
      expect(vi.mocked(updateProfile).mock.calls[0][1]?.aborted).toBe(true);
      await act(async () => {
        if (settlement === "resolve") pending.resolve(account);
        else pending.reject(new Error("Obsolete failure"));
      });
      expect(fetchCurrentUser).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
    },
  );

  it.each(["resolve", "reject"] as const)(
    "ignores a stale session %s and permits the new account to save",
    async (settlement) => {
      const pending = deferred<CurrentUser>();
      vi.mocked(updateProfile).mockReturnValueOnce(pending.promise);
      const { user } = render(<Harness />);
      const button = submit();
      await user.click(button);
      await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
      await user.click(screen.getByRole("button", { name: "New session" }));
      await act(async () => {
        if (settlement === "resolve") pending.resolve(account);
        else pending.reject(new Error("Old session failure"));
      });
      expect(getAccessToken()).toBe("newer-session");
      expect(messages.error).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
      expect(fetchCurrentUser).not.toHaveBeenCalled();
      await waitFor(() => expect(button).toBeEnabled());
      await user.click(button);
      await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(2));
      expect(vi.mocked(updateProfile).mock.calls[1][0]).toEqual({
        firstName: "Grace",
        lastName: "Lovelace",
      });
    },
  );

  it("ignores an error when login changes before the direct request catch runs", async () => {
    const pending = deferred<CurrentUser>();
    vi.mocked(updateProfile).mockReturnValueOnce(pending.promise);
    const { user } = render(<Harness />);
    await user.click(submit());
    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
    await act(async () => {
      pending.reject(new Error("Old session failure"));
      setAccessToken("newer-session");
    });
    expect(getAccessToken()).toBe("newer-session");
    expect(messages.error).not.toHaveBeenCalled();
    expect(fetchCurrentUser).not.toHaveBeenCalled();
  });

  it("ignores completion of a refresh belonging to the previous session", async () => {
    const pending = deferred<void>();
    fetchCurrentUser.mockReturnValueOnce(pending.promise);
    const { user } = render(<Harness />);
    await user.click(submit());
    await waitFor(() => expect(fetchCurrentUser).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "New session" }));
    await act(async () => pending.resolve(undefined));
    expect(messages.success).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("newer-session");
  });

  it("suppresses cancellation errors and releases the form for retry", async () => {
    vi.mocked(updateProfile).mockRejectedValueOnce(
      new CanceledError("Cancelled"),
    );
    const { user } = render(<Harness />);
    await user.click(submit());
    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
    await waitFor(() => expect(submit()).toBeEnabled());
    expect(messages.error).not.toHaveBeenCalled();
    await user.click(submit());
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(2));
  });
});
