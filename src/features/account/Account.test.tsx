// @vitest-environment jsdom
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { createContext, useContext, useState } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword } from "@/features/auth";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/shared/api";
import { i18nInstance } from "@/shared/i18n/index.ts";
import { render, screen } from "@/test/render.tsx";

import { AccountPage } from "./Account.tsx";
import {
  getAccount,
  requestEmailVerification,
  updateProfile,
  updateUsername,
  verifyEmail,
} from "./api.ts";
import type { Account } from "./types.ts";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("./api.ts", () => ({
  getAccount: vi.fn(),
  requestEmailVerification: vi.fn(),
  updateProfile: vi.fn(),
  updateUsername: vi.fn(),
  verifyEmail: vi.fn(),
}));
vi.mock("@/features/auth", () => ({ changePassword: vi.fn() }));
const AccountContext = createContext<
  { user?: Account; setUser: (user?: Account) => void } | undefined
>(undefined);
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages }),
  useCore: () => useContext(AccountContext),
}));

const account: Account = {
  email: "ada@example.com",
  firstName: "Ada",
  id: "account-1",
  isSystemAdmin: false,
  lastName: "Lovelace",
  mobile: "09120000000",
  permissions: [],
  status: "active",
  username: "ada",
};

const Harness = () => {
  const [user, setUser] = useState<Account | undefined>(account);
  return (
    <AccountContext.Provider value={{ user, setUser }}>
      <MemoryRouter initialEntries={["/account"]}>
        <output aria-label="current-account">{JSON.stringify(user)}</output>
        <button
          onClick={() => {
            setAccessToken("newer-session");
            setUser({ ...account, username: "new-session" });
          }}
          type="button"
        >
          New session
        </button>
        <Link to="/away">Leave account</Link>
        <Routes>
          <Route element={<AccountPage />} path="/account" />
          <Route element={<h1>Away</h1>} path="/away" />
          <Route element={<h1>Login</h1>} path="/auth" />
        </Routes>
      </MemoryRouter>
    </AccountContext.Provider>
  );
};
const currentAccount = (): Account =>
  JSON.parse(screen.getByLabelText("current-account").textContent ?? "{}");
const fillOtp = async (user: ReturnType<typeof render>["user"]) => {
  await user.type(
    within(screen.getByRole("group")).getAllByRole("textbox")[0],
    "123456",
  );
};

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
  setAccessToken("synthetic-session");
  vi.mocked(getAccount).mockReset().mockResolvedValue(account);
  vi.mocked(requestEmailVerification)
    .mockReset()
    .mockResolvedValue({ expiresIn: 120, remainingSeconds: 30 });
  vi.mocked(updateProfile).mockReset().mockResolvedValue(account);
  vi.mocked(updateUsername).mockReset().mockResolvedValue(account);
  vi.mocked(verifyEmail).mockReset().mockResolvedValue(undefined);
  vi.mocked(changePassword).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  clearAccessToken();
});

describe("AccountPage", () => {
  it("keeps invalid email validation inline without a generic OTP error", async () => {
    const { user } = render(<Harness />);
    const email = screen.getByLabelText(i18nInstance.t("email"));
    await user.clear(email);
    await user.type(email, "invalid");
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("sendCode") }),
    );
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(requestEmailVerification).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("reserves one OTP request before validation and starts its cooldown", async () => {
    render(<Harness />);
    const send = screen.getByRole("button", {
      name: i18nInstance.t("sendCode"),
    });
    await act(async () => {
      fireEvent.click(send);
      fireEvent.click(send);
    });
    await waitFor(() =>
      expect(requestEmailVerification).toHaveBeenCalledOnce(),
    );
    expect(requestEmailVerification).toHaveBeenCalledWith(
      { email: account.email },
      expect.any(AbortSignal),
    );
    expect(send).toBeDisabled();
    expect(send).toHaveTextContent("30");
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(messages.success).toHaveBeenCalledWith(
      i18nInstance.t("codeRequested"),
    );
  });

  it("clears the old OTP and rejects a late request when the email changes", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof requestEmailVerification>>,
    ) => void;
    vi.mocked(requestEmailVerification).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = render(<Harness />);
    await fillOtp(user);
    const inputs = within(screen.getByRole("group")).getAllByRole("textbox");
    const send = screen.getByRole("button", {
      name: i18nInstance.t("sendCode"),
    });
    await user.click(send);
    await waitFor(() =>
      expect(requestEmailVerification).toHaveBeenCalledOnce(),
    );
    const email = screen.getByLabelText(i18nInstance.t("email"));
    await user.clear(email);
    await user.type(email, "new@example.com");
    await act(async () => {
      resolve({ expiresIn: 120, remainingSeconds: 30 });
    });
    for (const input of inputs) expect(input).toHaveValue("");
    expect(send).toBeEnabled();
    expect(send).toHaveTextContent(i18nInstance.t("sendCode"));
    expect(messages.success).not.toHaveBeenCalled();
    expect(vi.mocked(requestEmailVerification).mock.calls[0][1]?.aborted).toBe(
      true,
    );
  });

  it.each(["profile", "username"] as const)(
    "preserves both edited fields when the %s DTO arrives last",
    async (last) => {
      let resolveProfile!: (value: Account) => void;
      let resolveUsername!: (value: Account) => void;
      vi.mocked(updateProfile).mockReturnValueOnce(
        new Promise((done) => {
          resolveProfile = done;
        }),
      );
      vi.mocked(updateUsername).mockReturnValueOnce(
        new Promise((done) => {
          resolveUsername = done;
        }),
      );
      const { user } = render(<Harness />);
      const firstName = screen.getByLabelText(i18nInstance.t("firstName"));
      await user.clear(firstName);
      await user.type(firstName, "Augusta");
      await user.click(
        screen.getByRole("button", { name: i18nInstance.t("saveProfile") }),
      );
      await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
      const username = screen.getByLabelText(i18nInstance.t("username"));
      await user.clear(username);
      await user.type(username, "newer");
      await user.click(
        screen.getByRole("button", { name: i18nInstance.t("saveUsername") }),
      );
      await waitFor(() => expect(updateUsername).toHaveBeenCalledOnce());
      await act(async () => {
        if (last === "profile") {
          resolveUsername({ ...account, username: "newer" });
          resolveProfile({ ...account, firstName: "Augusta" });
        } else {
          resolveProfile({ ...account, firstName: "Augusta" });
          resolveUsername({ ...account, username: "newer" });
        }
      });
      expect(currentAccount()).toEqual({
        ...account,
        firstName: "Augusta",
        username: "newer",
      });
    },
  );

  it("ignores profile completion after leaving the account page", async () => {
    let resolve!: (value: Account) => void;
    vi.mocked(updateProfile).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("link", { name: "Leave account" }));
    await screen.findByRole("heading", { name: "Away" });
    await act(async () => {
      resolve({ ...account, firstName: "Obsolete" });
    });
    expect(currentAccount()).toEqual(account);
    expect(messages.success).not.toHaveBeenCalled();
    expect(vi.mocked(updateProfile).mock.calls[0][1]?.aborted).toBe(true);
  });

  it("does not clear a newer login after an old password change completes", async () => {
    let resolve!: () => void;
    vi.mocked(changePassword).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = render(<Harness />);
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
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("changePassword") }),
    );
    await waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "New session" }));
    await act(async () => {
      resolve();
    });
    expect(getAccessToken()).toBe("newer-session");
    expect(currentAccount().username).toBe("new-session");
    expect(
      screen.queryByRole("heading", { name: "Login" }),
    ).not.toBeInTheDocument();
    expect(messages.success).not.toHaveBeenCalled();
  });

  it("invalidates verification when the email changes before it completes", async () => {
    let resolve!: () => void;
    vi.mocked(verifyEmail).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = render(<Harness />);
    await fillOtp(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("verifyEmail") }),
    );
    await waitFor(() => expect(verifyEmail).toHaveBeenCalledOnce());
    const email = screen.getByLabelText(i18nInstance.t("email"));
    await user.clear(email);
    await user.type(email, "new@example.com");
    await act(async () => {
      resolve();
    });
    expect(getAccount).not.toHaveBeenCalled();
    expect(currentAccount()).toEqual(account);
    expect(messages.success).not.toHaveBeenCalled();
  });

  it("clears the current session after a successful password change", async () => {
    const { user } = render(<Harness />);
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
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("changePassword") }),
    );
    await screen.findByRole("heading", { name: "Login" });
    expect(getAccessToken()).toBeNull();
    expect(changePassword).toHaveBeenCalledWith(
      { currentPassword: "old-secret", newPassword: "new-secret" },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledWith(
      i18nInstance.t("passwordChanged"),
    );
  });

  it("retries a failed account refresh without repeating email verification", async () => {
    vi.mocked(getAccount)
      .mockRejectedValueOnce(new Error("Account refresh unavailable"))
      .mockResolvedValueOnce({ ...account, email: "verified@example.com" });
    const { user } = render(<Harness />);
    await fillOtp(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("verifyEmail") }),
    );
    await screen.findByText("Account refresh unavailable");
    expect(messages.success).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("retry") }),
    );
    await waitFor(() =>
      expect(currentAccount().email).toBe("verified@example.com"),
    );
    expect(verifyEmail).toHaveBeenCalledOnce();
    expect(getAccount).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText("Account refresh unavailable"),
    ).not.toBeInTheDocument();
  });

  it("names the required OTP and verifies only the email contract", async () => {
    vi.mocked(getAccount).mockResolvedValueOnce({
      ...account,
      email: "new@example.com",
      username: "stale-username",
    });
    const { user } = render(<Harness />);
    const email = screen.getByLabelText(i18nInstance.t("email"));
    await user.clear(email);
    await user.type(email, "new@example.com");
    const group = screen.getByRole("group", { name: i18nInstance.t("otp") });
    expect(group).toHaveAccessibleDescription(i18nInstance.t("requiredField"));
    await fillOtp(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("verifyEmail") }),
    );
    await waitFor(() =>
      expect(messages.success).toHaveBeenCalledWith(
        i18nInstance.t("emailVerified"),
      ),
    );
    expect(verifyEmail).toHaveBeenCalledWith(
      { email: "new@example.com", otp: "123456" },
      expect.any(AbortSignal),
    );
    expect(currentAccount()).toEqual({ ...account, email: "new@example.com" });
    for (const input of within(group).getAllByRole("textbox"))
      expect(input).toHaveValue("");
  });

  it("allows a failed username update to be retried without losing input", async () => {
    vi.mocked(updateUsername)
      .mockRejectedValueOnce(new Error("Username unavailable"))
      .mockResolvedValueOnce({ ...account, username: "newer" });
    const { user } = render(<Harness />);
    const username = screen.getByLabelText(i18nInstance.t("username"));
    await user.clear(username);
    await user.type(username, "newer");
    const submit = screen.getByRole("button", {
      name: i18nInstance.t("saveUsername"),
    });
    await user.click(submit);
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Username unavailable"),
    );
    expect(username).toHaveValue("newer");
    await user.click(submit);
    await waitFor(() => expect(currentAccount().username).toBe("newer"));
    expect(updateUsername).toHaveBeenCalledTimes(2);
  });

  it("does not report a rejected operation after the account page unmounts", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(updateProfile).mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const { user } = render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("link", { name: "Leave account" }));
    await act(async () => {
      reject(new Error("Obsolete failure"));
    });
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("ignores an error invalidated between mutation rejection and the caller catch", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(updateProfile).mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const { user } = render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());

    await act(async () => {
      reject(new Error("Old session failure"));
      queueMicrotask(() => setAccessToken("newer-session"));
    });

    expect(getAccessToken()).toBe("newer-session");
    expect(messages.error).not.toHaveBeenCalled();
    expect(currentAccount()).toEqual(account);
  });
});
