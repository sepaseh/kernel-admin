import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { useLock } from "./useLock";

afterEach(cleanup);

it("blocks duplicate writes synchronously until the owner releases the lock", () => {
  const { result, rerender } = renderHook(useLock);
  expect(result.current.lock()).toBe(true);
  expect(result.current.lock()).toBe(false);
  rerender();
  expect(result.current.lock()).toBe(false);
  result.current.unlock();
  expect(result.current.lock()).toBe(true);
});

it("keeps independent form locks separate", () => {
  const { result } = renderHook(() => ({
    first: useLock(),
    second: useLock(),
  }));
  expect(result.current.first.lock()).toBe(true);
  expect(result.current.second.lock()).toBe(true);
  result.current.first.unlock();
  expect(result.current.second.lock()).toBe(false);
});
