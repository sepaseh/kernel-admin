import { cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoreContext, type CoreContextValue } from "@/app/contexts";

import { useCore } from "./useCore";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("core context hook", () => {
  it("returns the exact provided context", () => {
    const value = { currentRoute: "root" } as CoreContextValue;
    const wrapper = ({ children }: PropsWithChildren) => (
      <CoreContext value={value}>{children}</CoreContext>
    );
    expect(renderHook(useCore, { wrapper }).result.current).toBe(value);
  });

  it("explains a missing provider instead of returning incomplete state", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(useCore)).toThrow(
      "useCore must be used within a CoreProvider",
    );
  });
});
