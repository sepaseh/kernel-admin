// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type * as ReactRouter from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGoBack } from "./useGoBack";

const mocks = vi.hoisted(() => ({
  location: { pathname: "/users", state: null as unknown },
  navigate: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
}));

beforeEach(() => {
  mocks.location = { pathname: "/users", state: null };
});

describe("useGoBack", () => {
  it("returns to history when route state exists", () => {
    mocks.location.state = { from: "/roles" };
    const { result } = renderHook(() => useGoBack());
    act(() => result.current("/fallback"));
    expect(mocks.navigate).toHaveBeenCalledWith(-1);
  });

  it("navigates to an explicit fallback with options", () => {
    const { result } = renderHook(() => useGoBack());
    act(() => result.current("/fallback", { replace: true }));
    expect(mocks.navigate).toHaveBeenCalledWith("/fallback", { replace: true });
  });

  it("replaces the current path when no destination exists", () => {
    const { result } = renderHook(() => useGoBack());
    act(() => result.current());
    expect(mocks.navigate).toHaveBeenCalledWith("/users", { replace: true });
  });
});
