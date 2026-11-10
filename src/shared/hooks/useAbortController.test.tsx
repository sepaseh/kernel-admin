import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useAbortController } from "./useAbortController";

afterEach(cleanup);

describe("owned request cancellation", () => {
  it("cancels the preceding request when a replacement starts", () => {
    const { result } = renderHook(useAbortController);
    let first!: AbortSignal;
    let second!: AbortSignal;

    act(() => {
      first = result.current.start();
      second = result.current.start();
    });

    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });

  it("cancels active work on unmount", () => {
    const { result, unmount } = renderHook(useAbortController);
    const signal = result.current.start();

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
