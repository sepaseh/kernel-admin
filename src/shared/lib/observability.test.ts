// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("web-vitals", () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

import {
  initializeObservability,
  reportError,
  sanitizeObservabilityValue,
  setObservabilityTransport,
} from "./observability";

const originalPerformanceObserver = globalThis.PerformanceObserver;

afterEach(() => {
  globalThis.PerformanceObserver = originalPerformanceObserver;
  setObservabilityTransport();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("observability", () => {
  it("correlates API errors without copying arbitrary error properties", () => {
    const send = vi.fn();
    setObservabilityTransport(send);
    reportError(
      Object.assign(new Error("API failed"), {
        password: "synthetic-secret",
        requestId: "request-123",
      }),
      { source: "api" },
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { requestId: "request-123", source: "api" },
      }),
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain("synthetic-secret");
    reportError(
      Object.assign(new Error("API failed"), { requestId: "bad.value" }),
    );
    expect(send.mock.calls[1][0].context).toBeUndefined();
  });

  it("redacts valid email addresses without changing malformed addresses", () => {
    expect(
      sanitizeObservabilityValue(
        "Contact ada@example.com or grace+alerts@research.example.co.uk",
      ),
    ).toBe("Contact [redacted] or [redacted]");
    expect(
      sanitizeObservabilityValue(
        "Malformed: ada@example, ada@.example.com, and @example.com",
      ),
    ).toBe("Malformed: ada@example, ada@.example.com, and @example.com");
  });

  it("handles long non-matching text without excessive backtracking", () => {
    const value = "a".repeat(200_000);

    expect(sanitizeObservabilityValue(value)).toBe(value.slice(0, 2_000));
  });

  it("handles adversarial dot-heavy email text without backtracking", () => {
    const value = `a@${"label.".repeat(20_000)}!`;

    expect(sanitizeObservabilityValue(value)).toBe(value.slice(0, 2_000));
  });

  it("redacts empty, repeated, and encoded query values", () => {
    expect(
      sanitizeObservabilityValue(
        "http://example.com/path?empty=&next=value&redirect=http%3A%2F%2Fprivate.example",
      ),
    ).toBe("http://example.com/path?[redacted]&[redacted]&[redacted]");
  });

  it("handles long query-like text without excessive backtracking", () => {
    const value = `http://example.com/?${"key".repeat(70_000)}`;

    expect(sanitizeObservabilityValue(value)).toBe(value.slice(0, 2_000));
  });

  it("redacts sensitive values recursively", () => {
    expect(
      sanitizeObservabilityValue({
        email: "ada@example.com",
        nested: {
          password: "correct horse battery staple",
          url: "http://example.com/path?token=secret&view=private",
        },
      }),
    ).toEqual({
      email: "[redacted]",
      nested: {
        password: "[redacted]",
        url: "http://example.com/path?[redacted]&[redacted]",
      },
    });
  });

  it("reports cyclic context without losing safe fields or exposing secrets", () => {
    const send = vi.fn();
    const context: Record<string, unknown> = {
      source: "synthetic",
      token: "synthetic-secret",
    };
    context.self = context;
    setObservabilityTransport(send);

    expect(() => reportError(new Error("failed"), context)).not.toThrow();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          self: "[redacted]",
          source: "synthetic",
          token: "[redacted]",
        },
      }),
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain("synthetic-secret");
  });

  it("does not invoke context accessors and bounds deeply nested values", () => {
    const getter = vi.fn(() => {
      throw new Error("context getter failed");
    });
    const context = Object.defineProperty({ source: "synthetic" }, "detail", {
      enumerable: true,
      get: getter,
    });
    expect(sanitizeObservabilityValue(context)).toEqual({
      detail: "[redacted]",
      source: "synthetic",
    });
    const send = vi.fn();
    setObservabilityTransport(send);
    reportError(
      Object.assign(new Error("failed"), { requestId: "request-123" }),
      context,
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          detail: "[redacted]",
          requestId: "request-123",
          source: "synthetic",
        },
      }),
    );
    expect(getter).not.toHaveBeenCalled();

    let nested: unknown = "leaf";
    for (let index = 0; index < 20_000; index++) nested = { nested };
    expect(() => sanitizeObservabilityValue(nested)).not.toThrow();
    expect(JSON.stringify(sanitizeObservabilityValue(nested))).toContain(
      "[redacted]",
    );
  });

  it("isolates hostile error coercion and context inspection", () => {
    const error = {
      toString() {
        throw new Error("error coercion failed");
      },
    };
    const context = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("context inspection failed");
        },
      },
    );
    expect(() => reportError(error)).not.toThrow();
    expect(() => reportError(new Error("failed"), context)).not.toThrow();
  });

  it("preserves repeated safe values while bounding wide contexts", () => {
    const shared = { email: "ada@example.com", source: "synthetic" };
    expect(
      sanitizeObservabilityValue({ first: shared, second: shared }),
    ).toEqual({
      first: { email: "[redacted]", source: "synthetic" },
      second: { email: "[redacted]", source: "synthetic" },
    });
    const wide = Array.from({ length: 20_000 }, (_, index) => index);
    const sanitized = sanitizeObservabilityValue(wide);
    expect(Array.isArray(sanitized)).toBe(true);
    expect((sanitized as unknown[]).length).toBeLessThan(wide.length);
  });

  it("redacts values that JSON cannot represent safely", () => {
    expect(
      sanitizeObservabilityValue({
        callback: () => "synthetic-secret",
        infinite: Infinity,
        integer: 1n,
        missing: undefined,
        nan: Number.NaN,
        symbol: Symbol("synthetic-secret"),
      }),
    ).toEqual({
      callback: "[redacted]",
      infinite: "[redacted]",
      integer: "[redacted]",
      missing: "[redacted]",
      nan: "[redacted]",
      symbol: "[redacted]",
    });
  });

  it("reports sanitized structured errors with a release", () => {
    const send = vi.fn();
    setObservabilityTransport(send);

    reportError(
      new Error(
        "Failed for ada@example.com with token=secret at " +
          "http://example.com/path?access=secret",
      ),
      { authorization: "Bearer secret", source: "test" },
    );

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          authorization: "[redacted]",
          source: "test",
        },
        message: expect.not.stringContaining("ada@example.com"),
        name: "error",
        release: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
    expect(JSON.stringify(send.mock.calls[0])).not.toContain("secret");
  });

  it("reports browser errors and keeps long tasks as a diagnostic", () => {
    const callbacks: PerformanceObserverCallback[] = [];
    const observe = vi.fn();

    class PerformanceObserverMock {
      static supportedEntryTypes = ["longtask"];

      constructor(callback: PerformanceObserverCallback) {
        callbacks.push(callback);
      }

      disconnect() {}

      observe = observe;

      takeRecords() {
        return [];
      }
    }

    globalThis.PerformanceObserver =
      PerformanceObserverMock as unknown as typeof PerformanceObserver;

    const send = vi.fn();
    setObservabilityTransport(send);
    initializeObservability();
    initializeObservability();

    window.dispatchEvent(
      new ErrorEvent("error", {
        colno: 4,
        error: new Error("render failed"),
        filename: "app.tsx",
        lineno: 12,
        message: "render failed",
      }),
    );
    const rejection = new Event("unhandledrejection");
    Object.defineProperty(rejection, "reason", {
      value: new Error("request failed"),
    });
    window.dispatchEvent(rejection);

    const notify = (
      callback: PerformanceObserverCallback,
      entries: Partial<PerformanceEntry>[],
    ) => {
      callback(
        {
          getEntries: () => entries as PerformanceEntryList,
          getEntriesByName: () => [],
          getEntriesByType: () => [],
        },
        {} as PerformanceObserver,
      );
    };

    notify(callbacks[0], [{ duration: 51.234 }]);

    expect(observe).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ metric: "long-task", value: 51.23 }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ source: "window.error" }),
        name: "error",
      }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { source: "unhandledrejection" },
        name: "error",
      }),
    );
  });

  it("sends events to the configured endpoint without surfacing failures", async () => {
    vi.resetModules();
    vi.stubEnv(
      "VITE_OBSERVABILITY_URL",
      "http://observability.example.com/events",
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));
    const { reportError: reportWithDefaultTransport } =
      await import("./observability");

    reportWithDefaultTransport("failed for ada@example.com");

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "http://observability.example.com/events",
      expect.objectContaining({
        body: expect.not.stringContaining("ada@example.com"),
        method: "POST",
      }),
    );
  });

  it("never executes context toJSON or serializes its unsanitized output", async () => {
    vi.resetModules();
    vi.stubEnv(
      "VITE_OBSERVABILITY_URL",
      "http://observability.example.com/events",
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response());
    const toJSON = vi.fn(() => ({ token: "synthetic-secret" }));
    const { reportError: reportWithDefaultTransport } =
      await import("./observability");

    reportWithDefaultTransport(new Error("failed"), {
      source: "synthetic",
      toJSON,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(toJSON).not.toHaveBeenCalled();
    const body = fetchMock.mock.calls[0][1]!.body as string;
    expect(body).not.toContain("synthetic-secret");
    expect(JSON.parse(body).context).toEqual({
      source: "synthetic",
      toJSON: "[redacted]",
    });
  });
});
