// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import { CanceledError } from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { login } from "@/features/auth/api.ts";
import { i18nInstance } from "@/shared/i18n/index.ts";
import { render, screen } from "@/test/render.tsx";

import { LoginPage } from "./Login.tsx";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/features/auth/api.ts", () => ({ login: vi.fn() }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages }),
  useCore: () => ({ logos: { light: "/logo.svg" }, theme: "light" }),
}));

const Location = () => (
  <output aria-label="location">{useLocation().pathname}</output>
);
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/auth"]}>
      <Location />
      <Routes>
        <Route element={<LoginPage />} path="/auth" />
        <Route element={<h1>Recover</h1>} path="/auth/forgot-password" />
        <Route element={<h1>Dashboard</h1>} path="/" />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
  vi.mocked(login).mockReset().mockResolvedValue({ accessToken: "synthetic" });
});

const fillCredentials = async (user: ReturnType<typeof render>["user"]) => {
  await user.type(screen.getByLabelText(i18nInstance.t("identifier")), "ada");
  await user.type(
    screen.getByLabelText(i18nInstance.t("password"), { exact: true }),
    "secret",
  );
};

describe("LoginPage", () => {
  it("submits only the credentials and navigates after successful authentication", async () => {
    const { user } = renderPage();
    await fillCredentials(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("login") }),
    );
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(login).toHaveBeenCalledWith(
      { identifier: "ada", password: "secret" },
      expect.any(AbortSignal),
    );
  });

  it("aborts an obsolete login and does not redirect after leaving the page", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof login>>) => void;
    vi.mocked(login).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = renderPage();
    await fillCredentials(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("login") }),
    );
    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    await user.click(
      screen.getByRole("link", { name: i18nInstance.t("forgotPassword") }),
    );
    await screen.findByRole("heading", { name: "Recover" });
    await act(async () => {
      resolve({ accessToken: "obsolete" });
    });
    expect(screen.getByLabelText("location")).toHaveTextContent(
      "/auth/forgot-password",
    );
    expect(vi.mocked(login).mock.calls[0][1]?.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("shows a retryable server error and preserves entered credentials", async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error("Temporarily offline"));
    const { user } = renderPage();
    await fillCredentials(user);
    const submit = screen.getByRole("button", {
      name: i18nInstance.t("login"),
    });
    await user.click(submit);
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Temporarily offline"),
    );
    expect(screen.getByLabelText(i18nInstance.t("identifier"))).toHaveValue(
      "ada",
    );
    await user.click(submit);
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("does not show an error or navigate for a canceled login", async () => {
    vi.mocked(login).mockRejectedValueOnce(new CanceledError());
    const { user } = renderPage();
    await fillCredentials(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("login") }),
    );
    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    expect(messages.error).not.toHaveBeenCalled();
    expect(screen.getByLabelText("location")).toHaveTextContent("/auth");
  });
});
