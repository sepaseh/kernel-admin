// @vitest-environment jsdom
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { register, requestOtp } from "@/features/auth/api.ts";
import { i18nInstance } from "@/shared/i18n/index.ts";
import { render, screen } from "@/test/render.tsx";

import { RegisterPage } from "./Register.tsx";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/features/auth/api.ts", () => ({
  register: vi.fn(),
  requestOtp: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));
const Location = () => (
  <output aria-label="location">{useLocation().pathname}</output>
);
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/auth/register"]}>
      <Location />
      <Routes>
        <Route element={<RegisterPage />} path="/auth/register" />
        <Route element={<h1>Login</h1>} path="/auth" />
        <Route element={<h1>Dashboard</h1>} path="/" />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
  vi.mocked(register)
    .mockReset()
    .mockResolvedValue({ accessToken: "synthetic" });
  vi.mocked(requestOtp)
    .mockReset()
    .mockResolvedValue({ expiresIn: 120, remainingSeconds: 30 });
});

const fillRegistration = async (user: ReturnType<typeof render>["user"]) => {
  await user.type(screen.getByLabelText(i18nInstance.t("firstName")), "Ada");
  await user.type(
    screen.getByLabelText(i18nInstance.t("lastName")),
    "Lovelace",
  );
  await user.type(
    screen.getByLabelText(i18nInstance.t("mobile")),
    "09120000000",
  );
  const otp = screen.getByRole("group", { name: i18nInstance.t("otp") });
  await user.type(within(otp).getAllByRole("textbox")[0], "123456");
  await user.type(
    screen.getByLabelText(i18nInstance.t("password"), { exact: true }),
    "secret",
  );
  await user.type(
    screen.getByLabelText(i18nInstance.t("confirmPassword")),
    "secret",
  );
};

describe("RegisterPage", () => {
  it("deduplicates OTP clicks while mobile validation is pending", async () => {
    const { user } = renderPage();
    await user.type(
      screen.getByLabelText(i18nInstance.t("mobile")),
      "09120000000",
    );
    const send = screen.getByRole("button", {
      name: i18nInstance.t("sendCode"),
    });
    await act(async () => {
      fireEvent.click(send);
      fireEvent.click(send);
    });
    await waitFor(() => expect(requestOtp).toHaveBeenCalled());
    expect(requestOtp).toHaveBeenCalledTimes(1);
    expect(requestOtp).toHaveBeenCalledWith(
      { mobile: "09120000000", purpose: "register" },
      expect.any(AbortSignal),
    );
    expect(send).toBeDisabled();
    expect(send).toHaveTextContent("30");
  });

  it("invalidates an OTP request when its mobile changes", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof requestOtp>>) => void;
    vi.mocked(requestOtp).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = renderPage();
    const mobile = screen.getByLabelText(i18nInstance.t("mobile"));
    await user.type(mobile, "09120000000");
    const otpInputs = within(
      screen.getByRole("group", { name: i18nInstance.t("otp") }),
    ).getAllByRole("textbox");
    await user.type(otpInputs[0], "123456");
    const send = screen.getByRole("button", {
      name: i18nInstance.t("sendCode"),
    });
    await user.click(send);
    await waitFor(() => expect(requestOtp).toHaveBeenCalledOnce());
    await user.clear(mobile);
    await user.type(mobile, "09121111111");
    await act(async () => {
      resolve({ expiresIn: 120, remainingSeconds: 30 });
    });
    expect(vi.mocked(requestOtp).mock.calls[0][1]?.aborted).toBe(true);
    expect(send).toBeEnabled();
    expect(send).toHaveTextContent(i18nInstance.t("sendCode"));
    for (const input of otpInputs) expect(input).toHaveValue("");
    expect(messages.success).not.toHaveBeenCalled();
  });

  it("submits only the registration contract and navigates after success", async () => {
    const { user } = renderPage();
    await fillRegistration(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("register") }),
    );
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(register).toHaveBeenCalledWith(
      {
        firstName: "Ada",
        lastName: "Lovelace",
        mobile: "09120000000",
        otp: "123456",
        password: "secret",
      },
      expect.any(AbortSignal),
    );
  });

  it("submits with Enter once while registration is pending", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof register>>) => void;
    vi.mocked(register).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = renderPage();
    await fillRegistration(user);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(register).toHaveBeenCalledOnce());

    await user.keyboard("{Enter}{Enter}");
    expect(register).toHaveBeenCalledOnce();
    expect(requestOtp).not.toHaveBeenCalled();
    expect(vi.mocked(register).mock.calls[0][1]?.aborted).toBe(false);

    await act(async () => {
      resolve({ accessToken: "synthetic" });
    });
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(register).toHaveBeenCalledOnce();
  });

  it("aborts registration when its page is left and ignores a late success", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof register>>) => void;
    vi.mocked(register).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = renderPage();
    await fillRegistration(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("register") }),
    );
    await waitFor(() => expect(register).toHaveBeenCalledOnce());
    await user.click(
      screen.getByRole("link", { name: i18nInstance.t("backToLogin") }),
    );
    await act(async () => {
      resolve({ accessToken: "obsolete" });
    });
    expect(screen.getByLabelText("location")).toHaveTextContent("/auth");
    expect(vi.mocked(register).mock.calls[0][1]?.aborted).toBe(true);
  });
});
