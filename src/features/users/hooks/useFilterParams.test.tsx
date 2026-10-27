// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type * as ReactRouter from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFilterParams } from "./useFilterParams";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams("offset=12&status=active"),
  setSearchParams: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
}));

beforeEach(() => {
  mocks.searchParams = new URLSearchParams("offset=12&status=active");
});

describe("useFilterParams", () => {
  it("reads filters and updates them without dropping unrelated values", () => {
    mocks.setSearchParams.mockImplementation((updater) => {
      mocks.searchParams = updater(mocks.searchParams);
    });
    const { result } = renderHook(() =>
      useFilterParams<{ offset: string; status: string }>(),
    );

    expect(result.current.filters).toEqual({ offset: "12", status: "active" });
    act(() => result.current.setFilters({ offset: "24" }));
    expect(mocks.searchParams.toString()).toBe("offset=24&status=active");
  });

  it.each([undefined, null, ""])("removes empty filter value %s", (value) => {
    mocks.setSearchParams.mockImplementation((updater) => {
      mocks.searchParams = updater(mocks.searchParams);
    });
    const { result } = renderHook(() =>
      useFilterParams<Record<string, string>>(),
    );

    act(() => result.current.setFilters({ status: value as string }));
    expect(mocks.searchParams.has("status")).toBe(false);
    expect(mocks.searchParams.get("offset")).toBe("12");
  });
});
