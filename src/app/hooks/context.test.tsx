// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import type { CoreContextValue } from "@/app/contexts";
import { CoreContext } from "@/app/contexts";

import { useCore } from "./useCore";

type ContextWrapperProps = PropsWithChildren;

describe("context hooks", () => {
  it("returns core context and rejects missing provider", () => {
    const value = {
      language: {
        calendar: "gregorian",
        code: "en",
        direction: "ltr",
        name: "English",
        nativeName: "English",
      },
    } as CoreContextValue;
    const wrapper = ({ children }: ContextWrapperProps) => (
      <CoreContext.Provider value={value}>{children}</CoreContext.Provider>
    );

    expect(renderHook(() => useCore(), { wrapper }).result.current).toBe(value);
    expect(() => renderHook(() => useCore())).toThrow(
      "useCore must be used within a CoreProvider",
    );
  });
});
