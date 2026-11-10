import "@/test/browser";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthModule from "@/features/auth";
import { forgotPassword } from "@/features/auth";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { ForgotPassPage } from "./ForgotPass";

const { messages } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/features/auth", async (original) => ({
  ...(await original<typeof AuthModule>()),
  forgotPassword: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/auth/forgot-password"]}>
      <Routes>
        <Route path="/auth/forgot-password" element={<ForgotPassPage />} />
        <Route
          path="/auth"
          element={
            <>
              <h1>Login again</h1>
              <Link to="/auth/register">Start registration</Link>
            </>
          }
        />
        <Route
          path="/auth/register"
          element={<h1>Registration remains active</h1>}
        />
      </Routes>
    </MemoryRouter>,
  );

const fillRecovery = () => {
  for (const [label, value] of [
    [i18n.t("mobile"), "09120000000"],
    [i18n.t("newPassword"), "synthetic-new-password"],
    [i18n.t("confirmPassword"), "synthetic-new-password"],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  within(screen.getByRole("group", { name: i18n.t("otp") }))
    .getAllByRole("textbox")
    .forEach((input, index) => {
      fireEvent.input(input, { target: { value: String(index + 1) } });
    });
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(forgotPassword).mockResolvedValue(undefined);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("password recovery form", () => {
  it("sends the OTP and new password and returns to login after success", async () => {
    renderPage();
    fillRecovery();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("resetPassword") }),
    );

    await screen.findByRole("heading", { name: "Login again" });
    expect(forgotPassword).toHaveBeenCalledExactlyOnceWith(
      {
        mobile: "09120000000",
        otp: "123456",
        password: "synthetic-new-password",
      },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledWith(i18n.t("passwordReset"));
  });

  it("retains recovery fields after a rejected OTP so the user can retry", async () => {
    vi.mocked(forgotPassword).mockRejectedValue(
      new Error("Synthetic invalid OTP"),
    );
    renderPage();
    fillRecovery();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("resetPassword") }),
    );

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Synthetic invalid OTP"),
    );
    expect(
      (screen.getByLabelText(i18n.t("mobile")) as HTMLInputElement).value,
    ).toBe("09120000000");
    expect(screen.queryByRole("heading", { name: "Login again" })).toBeNull();
  });

  it.each(["success", "error"] as const)(
    "ignores a late password-recovery %s after starting another auth flow",
    async (outcome) => {
      const pending = deferred<void>();
      vi.mocked(forgotPassword).mockReturnValue(pending.promise);
      renderPage();
      fillRecovery();
      fireEvent.click(
        screen.getByRole("button", { name: i18n.t("resetPassword") }),
      );
      await waitFor(() => expect(forgotPassword).toHaveBeenCalledTimes(1));
      const signal = vi.mocked(forgotPassword).mock.calls[0][1]!;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);

      fireEvent.click(
        screen.getByRole("link", { name: i18n.t("backToLogin") }),
      );
      await screen.findByRole("heading", { name: "Login again" });
      expect(signal.aborted).toBe(true);
      fireEvent.click(screen.getByRole("link", { name: "Start registration" }));
      await screen.findByRole("heading", {
        name: "Registration remains active",
      });
      await act(async () => {
        if (outcome === "success") pending.resolve();
        else pending.reject(new Error("Late password recovery failure"));
      });

      expect(
        screen.getByRole("heading", { name: "Registration remains active" }),
      ).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Login again" })).toBeNull();
      expect(messages.error).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
    },
  );
});
