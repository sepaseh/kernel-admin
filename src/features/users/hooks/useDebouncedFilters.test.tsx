// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useDebouncedFilters } from "./useDebouncedFilters";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("applies only the latest filters after a complete 500ms pause", () => {
  const setFilters = vi.fn();
  const { result } = renderHook(() => useDebouncedFilters(setFilters));
  act(() => result.current({ firstName: "A" }));
  act(() => vi.advanceTimersByTime(499));
  expect(setFilters).not.toHaveBeenCalled();
  act(() => result.current({ firstName: "Ada", offset: undefined }));
  act(() => vi.advanceTimersByTime(499));
  expect(setFilters).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(setFilters).toHaveBeenCalledExactlyOnceWith({
    firstName: "Ada",
    offset: undefined,
  });
});

it("does not write query parameters after its consumer unmounts", () => {
  const setFilters = vi.fn();
  const { result, unmount } = renderHook(() => useDebouncedFilters(setFilters));
  act(() => result.current({ firstName: "obsolete" }));
  unmount();
  act(() => vi.advanceTimersByTime(500));
  expect(setFilters).not.toHaveBeenCalled();
});

it("cancels a queued update when the query parameter owner changes", () => {
  const previous = vi.fn();
  const current = vi.fn();
  const { result, rerender } = renderHook(
    ({ setter }) => useDebouncedFilters(setter),
    {
      initialProps: { setter: previous },
    },
  );
  act(() => result.current({ firstName: "obsolete" }));
  rerender({ setter: current });
  act(() => vi.advanceTimersByTime(500));
  expect(previous).not.toHaveBeenCalled();
  expect(current).not.toHaveBeenCalled();
  act(() => result.current({ firstName: "current" }));
  act(() => vi.advanceTimersByTime(500));
  expect(current).toHaveBeenCalledExactlyOnceWith({ firstName: "current" });
});
