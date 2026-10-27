import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class ResizeObserverMock implements ResizeObserver {
  disconnect() {
    // No-op: JSDOM has no native ResizeObserver behavior to tear down.
  }

  observe() {
    // No-op: tests do not depend on real size-change notifications.
  }

  unobserve() {
    // No-op: no observation state is tracked by this JSDOM mock.
  }
}

if (typeof window !== "undefined")
  Object.defineProperty(window, "matchMedia", {
    value: (query: string): MediaQueryList => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }),
    writable: true,
  });

if (typeof window !== "undefined")
  globalThis.ResizeObserver = ResizeObserverMock;

afterEach(() => cleanup());
