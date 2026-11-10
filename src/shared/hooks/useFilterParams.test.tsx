import { act, cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { useFilterParams } from "./useFilterParams";

afterEach(cleanup);

const wrapper = ({ children }: PropsWithChildren) => (
  <MemoryRouter
    initialEntries={["/users?page=3&status=active&enabled=0&keep=custom"]}
  >
    {children}
  </MemoryRouter>
);

describe("URL filters", () => {
  it("reads and changes filters without dropping unrelated query values", () => {
    const { result } = renderHook(
      () => ({
        ...useFilterParams<{ page: string; status: string; enabled: string }>(),
        location: useLocation(),
      }),
      { wrapper },
    );
    expect(result.current.filters).toMatchObject({
      page: "3",
      status: "active",
      enabled: "0",
    });

    act(() => result.current.setFilters({ page: "1", enabled: "1" }));

    expect(result.current.location.pathname).toBe("/users");
    expect(
      new URLSearchParams(result.current.location.search).get("keep"),
    ).toBe("custom");
    expect(result.current.filters).toMatchObject({
      page: "1",
      status: "active",
      enabled: "1",
    });
  });

  it.each([undefined, ""])("removes empty filter %j", (status) => {
    const { result } = renderHook(() => useFilterParams<{ status: string }>(), {
      wrapper,
    });
    act(() => result.current.setFilters({ status }));
    expect(result.current.filters).not.toHaveProperty("status");
    expect(result.current.filters).toMatchObject({
      page: "3",
      enabled: "0",
      keep: "custom",
    });
  });
});
