// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useDebouncedFilters } from "./useDebouncedFilters";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("applies only the latest filters after a complete 500ms pause", () => {
  const setFilters = vi.fn();
  const { result } = renderHook(() => useDebouncedFilters(setFilters));
  act(() => result.current({ firstName: "A" }));
  act(() => vi.advanceTimersByTime(499));
  expect(setFilters).not.toHaveBeenCalled();
  act(() => result.current({ firstName: "Ada", page: undefined }));
  act(() => vi.advanceTimersByTime(499));
  expect(setFilters).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(setFilters).toHaveBeenCalledExactlyOnceWith({
    firstName: "Ada",
    page: undefined,
  });
});

it("cancels a pending URL write when its consumer unmounts", () => {
  const setFilters = vi.fn();
  const { result, unmount } = renderHook(() => useDebouncedFilters(setFilters));
  act(() => result.current({ name: "obsolete" }));
  unmount();
  act(() => vi.advanceTimersByTime(500));
  expect(setFilters).not.toHaveBeenCalled();
});

it("cancels obsolete writes when navigation replaces the setter", () => {
  const previous = vi.fn();
  const current = vi.fn();
  const { result, rerender } = renderHook(
    ({ setter }) => useDebouncedFilters(setter),
    {
      initialProps: { setter: previous },
    },
  );
  act(() => result.current({ name: "obsolete" }));
  rerender({ setter: current });
  act(() => vi.advanceTimersByTime(500));
  expect(previous).not.toHaveBeenCalled();
  expect(current).not.toHaveBeenCalled();

  act(() => result.current({ name: "current" }));
  act(() => vi.advanceTimersByTime(500));
  expect(current).toHaveBeenCalledExactlyOnceWith({ name: "current" });
});
