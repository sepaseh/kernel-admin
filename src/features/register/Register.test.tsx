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
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as AuthModule from "@/features/auth";
import { register } from "@/features/auth";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { RegisterPage } from "./Register";

const { messages } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/features/auth", async (original) => ({
  ...(await original<typeof AuthModule>()),
  register: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/auth/register"]}>
      <Routes>
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth" element={<h1>Login remains active</h1>} />
        <Route path="/" element={<h1>Dashboard</h1>} />
      </Routes>
    </MemoryRouter>,
  );

const fillRegistration = (confirmation = "synthetic-password") => {
  for (const [label, value] of [
    [i18n.t("firstName"), "Ada"],
    [i18n.t("lastName"), "Lovelace"],
    [i18n.t("mobile"), "09120000000"],
    [i18n.t("password"), "synthetic-password"],
    [i18n.t("confirmPassword"), confirmation],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  within(screen.getByRole("group", { name: i18n.t("otp") }))
    .getAllByRole("textbox")
    .forEach((input, index) => {
      fireEvent.input(input, { target: { value: String(index + 1) } });
    });
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(register).mockResolvedValue({ accessToken: "synthetic-token" });
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("registration form", () => {
  it("submits registration fields and excludes password confirmation", async () => {
    renderPage();
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("register") }));

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(register).toHaveBeenCalledExactlyOnceWith(
      {
        firstName: "Ada",
        lastName: "Lovelace",
        mobile: "09120000000",
        otp: "123456",
        password: "synthetic-password",
      },
      expect.any(AbortSignal),
    );
  });

  it("validates password confirmation before issuing a registration request", async () => {
    renderPage();
    fillRegistration("different-password");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("register") }));

    await screen.findByText(i18n.t("passwordMismatch"));
    expect(register).not.toHaveBeenCalled();
  });

  it("shows a service error and retains the form for correction", async () => {
    vi.mocked(register).mockRejectedValue(
      new Error("Synthetic mobile already registered"),
    );
    renderPage();
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("register") }));

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith(
        "Synthetic mobile already registered",
      ),
    );
    expect(
      (screen.getByLabelText(i18n.t("firstName")) as HTMLInputElement).value,
    ).toBe("Ada");
  });

  it.each(["success", "error"] as const)(
    "ignores a late registration %s after returning to login",
    async (outcome) => {
      const pending = deferred<{ accessToken: string }>();
      vi.mocked(register).mockReturnValue(pending.promise);
      renderPage();
      fillRegistration();
      fireEvent.click(screen.getByRole("button", { name: i18n.t("register") }));
      await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
      const signal = vi.mocked(register).mock.calls[0][1]!;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);

      fireEvent.click(
        screen.getByRole("link", { name: i18n.t("backToLogin") }),
      );
      await screen.findByRole("heading", { name: "Login remains active" });
      expect(signal.aborted).toBe(true);
      await act(async () => {
        if (outcome === "success")
          pending.resolve({ accessToken: "late-token" });
        else pending.reject(new Error("Late registration failure"));
      });

      expect(
        screen.getByRole("heading", { name: "Login remains active" }),
      ).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
      expect(messages.error).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
    },
  );
});
