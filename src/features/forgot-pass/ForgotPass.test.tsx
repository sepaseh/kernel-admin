// @vitest-environment jsdom
import { act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { forgotPassword, requestOtp } from "@/features/auth/api.ts";
import { i18nInstance } from "@/shared/i18n/index.ts";
import { render, screen } from "@/test/render.tsx";

import { ForgotPassPage } from "./ForgotPass.tsx";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/features/auth/api.ts", () => ({
  forgotPassword: vi.fn(),
  requestOtp: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));
const Location = () => (
  <output aria-label="location">{useLocation().pathname}</output>
);
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/auth/forgot-password"]}>
      <Location />
      <Routes>
        <Route element={<ForgotPassPage />} path="/auth/forgot-password" />
        <Route element={<h1>Login</h1>} path="/auth" />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
  vi.mocked(forgotPassword).mockReset().mockResolvedValue(undefined);
  vi.mocked(requestOtp)
    .mockReset()
    .mockResolvedValue({ expiresIn: 120, remainingSeconds: 30 });
});

describe("ForgotPassPage", () => {
  it("keeps invalid mobile validation local without sending an OTP request", async () => {
    const { user } = renderPage();
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("sendCode") }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText(i18nInstance.t("mobile"))).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(requestOtp).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("submits a reset without confirmation data and returns to login", async () => {
    const { user } = renderPage();
    await user.type(
      screen.getByLabelText(i18nInstance.t("mobile")),
      "09120000000",
    );
    await user.type(
      within(
        screen.getByRole("group", { name: i18nInstance.t("otp") }),
      ).getAllByRole("textbox")[0],
      "123456",
    );
    await user.type(
      screen.getByLabelText(i18nInstance.t("newPassword"), { exact: true }),
      "secret",
    );
    await user.type(
      screen.getByLabelText(i18nInstance.t("confirmPassword")),
      "secret",
    );
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("resetPassword") }),
    );
    await screen.findByRole("heading", { name: "Login" });
    expect(forgotPassword).toHaveBeenCalledWith(
      { mobile: "09120000000", otp: "123456", password: "secret" },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledWith(
      i18nInstance.t("passwordReset"),
    );
  });

  it("aborts its OTP request on unmount without showing a late success", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof requestOtp>>) => void;
    vi.mocked(requestOtp).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = renderPage();
    await user.type(
      screen.getByLabelText(i18nInstance.t("mobile")),
      "09120000000",
    );
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("sendCode") }),
    );
    await waitFor(() => expect(requestOtp).toHaveBeenCalledOnce());
    await user.click(
      screen.getByRole("link", { name: i18nInstance.t("backToLogin") }),
    );
    await act(async () => {
      resolve({ expiresIn: 120, remainingSeconds: 30 });
    });
    expect(vi.mocked(requestOtp).mock.calls[0][1]?.aborted).toBe(true);
    expect(messages.success).not.toHaveBeenCalled();
  });
});
