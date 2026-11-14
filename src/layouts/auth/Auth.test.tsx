import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAccessToken, getAccessToken, setAccessToken } from "@/shared/api";

import { AuthLayout } from "./Auth";

vi.mock("@/app/hooks", () => ({
  useAntd: () => ({
    token: {
      colorBgLayout: "#eee",
      colorBgContainer: "#fff",
      colorTextBase: "#111",
      paddingSM: 8,
      paddingLG: 24,
      screenXS: 480,
      borderRadiusLG: 8,
    },
  }),
}));
afterEach(() => {
  cleanup();
  clearAccessToken();
});

describe("authentication layout", () => {
  it("clears the previous in-memory session when displaying an authentication route", () => {
    setAccessToken("synthetic-prior-session");
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="*" element={<h1>Sign in</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(getAccessToken()).toBeNull();
    expect(
      screen
        .getByRole("main")
        .contains(screen.getByRole("heading", { name: "Sign in" })),
    ).toBe(true);
  });
});
