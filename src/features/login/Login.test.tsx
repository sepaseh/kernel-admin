import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { login } from "@/features/auth";
import { i18n } from "@/shared/i18n";
import "@/test/browser";
import { deferred } from "@/test/deferred";

import { LoginPage } from "./Login";

const { messages } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/features/auth", () => ({ login: vi.fn() }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages }),
  useCore: () => ({
    settings: { lightLogo: { url: "/synthetic-logo.svg" } },
    theme: "light",
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/auth"]}>
      <Routes>
        <Route path="/auth" element={<LoginPage />} />
        <Route path="/" element={<h1>Dashboard</h1>} />
        <Route path="/auth/forgot-password" element={<h1>Recovery</h1>} />
        <Route
          path="/auth/register"
          element={<h1>Registration remains active</h1>}
        />
      </Routes>
    </MemoryRouter>,
  );

const fillCredentials = () => {
  fireEvent.change(screen.getByLabelText(i18n.t("mobile")), {
    target: { value: "09abc120000000" },
  });
  fireEvent.change(screen.getByLabelText(i18n.t("password")), {
    target: { value: "synthetic-password" },
  });
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(login).mockResolvedValue({ accessToken: "synthetic-token" });
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("login form", () => {
  it("normalizes mobile digits, submits credentials and replaces the route after success", async () => {
    renderPage();
    expect(
      screen.getByRole("img", { name: i18n.t("logo") }).getAttribute("src"),
    ).toBe("/synthetic-logo.svg");
    fillCredentials();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("login") }));

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(login).toHaveBeenCalledExactlyOnceWith(
      { mobile: "09120000000", password: "synthetic-password" },
      expect.any(AbortSignal),
    );
  });

  it("keeps a failed submission retryable with its entered credentials", async () => {
    vi.mocked(login).mockRejectedValueOnce(
      new Error("Synthetic offline response"),
    );
    renderPage();
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("login") }));
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Synthetic offline response"),
    );
    expect(
      (screen.getByLabelText(i18n.t("mobile")) as HTMLInputElement).value,
    ).toBe("09120000000");

    fireEvent.click(screen.getByRole("button", { name: i18n.t("login") }));

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("prevents a second submit while authentication is pending", async () => {
    const pending = deferred<{ accessToken: string }>();
    vi.mocked(login).mockReturnValue(pending.promise);
    const { container } = renderPage();
    fillCredentials();
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.submit(form);
    });
    await act(async () => {
      pending.resolve({ accessToken: "synthetic-token" });
    });

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(login).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "error"] as const)(
    "ignores a late login %s after following the registration link",
    async (outcome) => {
      const pending = deferred<{ accessToken: string }>();
      vi.mocked(login).mockReturnValue(pending.promise);
      renderPage();
      fillCredentials();
      fireEvent.click(screen.getByRole("button", { name: i18n.t("login") }));
      await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
      const signal = vi.mocked(login).mock.calls[0][1]!;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);

      fireEvent.click(screen.getByRole("link", { name: i18n.t("register") }));
      await screen.findByRole("heading", {
        name: "Registration remains active",
      });
      expect(signal.aborted).toBe(true);
      await act(async () => {
        if (outcome === "success")
          pending.resolve({ accessToken: "late-token" });
        else pending.reject(new Error("Late login failure"));
      });

      expect(
        screen.getByRole("heading", { name: "Registration remains active" }),
      ).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
      expect(messages.error).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
    },
  );
});
