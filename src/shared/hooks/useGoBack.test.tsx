// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { useGoBack } from "./useGoBack";

afterEach(cleanup);

describe("drawer return navigation", () => {
  it("clears only the hash and preserves the current query after filters change", () => {
    const { result } = renderHook(
      () => ({
        goBack: useGoBack(),
        location: useLocation(),
        navigate: useNavigate(),
      }),
      {
        wrapper: ({ children }: PropsWithChildren) => (
          <MemoryRouter initialEntries={["/roles?keep=initial#create"]}>
            {children}
          </MemoryRouter>
        ),
      },
    );

    act(() => {
      void result.current.navigate("/roles?keep=reviewed&page=2#create", {
        replace: true,
      });
    });
    act(() => {
      result.current.goBack();
    });

    expect(result.current.location).toMatchObject({
      pathname: "/roles",
      search: "?keep=reviewed&page=2",
      hash: "",
    });
  });

  it("replaces a direct drawer URL so history cannot restore the cleared hash", () => {
    const { result } = renderHook(
      () => ({
        goBack: useGoBack(),
        location: useLocation(),
        navigate: useNavigate(),
      }),
      {
        wrapper: ({ children }: PropsWithChildren) => (
          <MemoryRouter
            initialEntries={["/account", "/roles?keep=role-list#create"]}
            initialIndex={1}
          >
            {children}
          </MemoryRouter>
        ),
      },
    );

    act(() => {
      result.current.goBack();
    });
    act(() => {
      void result.current.navigate(-1);
    });
    expect(result.current.location.pathname).toBe("/account");

    act(() => {
      void result.current.navigate(1);
    });
    expect(result.current.location).toMatchObject({
      pathname: "/roles",
      search: "?keep=role-list",
      hash: "",
    });
  });

  it("returns to the actual previous entry when the drawer has navigation state", () => {
    const { result } = renderHook(
      () => ({
        goBack: useGoBack(),
        location: useLocation(),
        navigate: useNavigate(),
      }),
      {
        wrapper: ({ children }: PropsWithChildren) => (
          <MemoryRouter
            initialEntries={[
              "/roles?keep=previous-list",
              {
                pathname: "/roles",
                search: "?keep=drawer-list",
                hash: "#update",
                state: true,
              },
            ]}
            initialIndex={1}
          >
            {children}
          </MemoryRouter>
        ),
      },
    );

    act(() => {
      result.current.goBack("/users", { replace: true });
    });
    expect(result.current.location).toMatchObject({
      pathname: "/roles",
      search: "?keep=previous-list",
      hash: "",
    });

    act(() => {
      void result.current.navigate(1);
    });
    expect(result.current.location).toMatchObject({
      pathname: "/roles",
      search: "?keep=drawer-list",
      hash: "#update",
      state: true,
    });
  });

  it("honors an explicit fallback destination and its navigation options", () => {
    const { result } = renderHook(
      () => ({
        goBack: useGoBack(),
        location: useLocation(),
        navigate: useNavigate(),
      }),
      {
        wrapper: ({ children }: PropsWithChildren) => (
          <MemoryRouter
            initialEntries={["/account", "/roles?keep=role-list#create"]}
            initialIndex={1}
          >
            {children}
          </MemoryRouter>
        ),
      },
    );

    act(() => {
      result.current.goBack(
        { pathname: "/users", search: "?status=active", hash: "#details" },
        { replace: true, state: { source: "role-drawer" } },
      );
    });
    expect(result.current.location).toMatchObject({
      pathname: "/users",
      search: "?status=active",
      hash: "#details",
      state: { source: "role-drawer" },
    });

    act(() => {
      void result.current.navigate(-1);
    });
    expect(result.current.location.pathname).toBe("/account");
  });
});
