// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Metric } from "web-vitals";

const registrations = vi.hoisted(() => ({
  onCLS: vi.fn<(report: (metric: Metric) => void) => void>(),
  onFCP: vi.fn<(report: (metric: Metric) => void) => void>(),
  onINP: vi.fn<(report: (metric: Metric) => void) => void>(),
  onLCP: vi.fn<(report: (metric: Metric) => void) => void>(),
  onTTFB: vi.fn<(report: (metric: Metric) => void) => void>(),
}));
vi.mock("web-vitals", () => registrations);

const originalObserver = globalThis.PerformanceObserver;
const metric = (
  name: Metric["name"],
  value: number,
  overrides: Partial<Metric> = {},
): Metric => ({
  delta: value,
  entries: [],
  id: "synthetic-visit",
  name,
  navigationId: 1,
  navigationType: "navigate",
  rating: "good",
  value,
  ...overrides,
});
const emit = (value: Metric) =>
  registrations[`on${value.name}`].mock.calls[0][0](value);
const start = async () => {
  const observability = await import("./observability");
  observability.initializeObservability();
  return observability;
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_OBSERVABILITY_URL", "");
  class UnsupportedObserver {
    static supportedEntryTypes = [];
  }
  globalThis.PerformanceObserver =
    UnsupportedObserver as unknown as typeof PerformanceObserver;
  vi.spyOn(window, "addEventListener").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.PerformanceObserver = originalObserver;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("admin standard Web Vitals", () => {
  it("registers each standard metric once per document, independently of React rerenders", async () => {
    const { initializeObservability } = await start();
    initializeObservability();
    initializeObservability();
    for (const registration of Object.values(registrations))
      expect(registration).toHaveBeenCalledExactlyOnceWith(
        expect.any(Function),
      );
  });

  it("preserves standard CLS scores and millisecond values instead of rounding or summing updates", async () => {
    const { setObservabilityTransport } = await start();
    const reports = vi.fn();
    setObservabilityTransport(reports);
    emit(metric("CLS", 0.000123));
    emit(metric("CLS", 0.000234, { delta: 0.000111 }));
    emit(
      metric("INP", 231.123, { delta: -1.234, rating: "needs-improvement" }),
    );
    for (const name of ["FCP", "LCP", "TTFB"] as const)
      emit(metric(name, 456.789));
    expect(
      reports.mock.calls.map(([value]) => [
        value.metric,
        value.value,
        value.unit,
      ]),
    ).toEqual([
      ["CLS", 0.000123, "score"],
      ["CLS", 0.000234, "score"],
      ["INP", 231.123, "milliseconds"],
      ["FCP", 456.789, "milliseconds"],
      ["LCP", 456.789, "milliseconds"],
      ["TTFB", 456.789, "milliseconds"],
    ]);
    expect(reports.mock.calls[2][0].delta).toBe(-1.234);
    expect(reports.mock.calls[2][0].rating).toBe("needs-improvement");
  });

  it("suppresses unchanged callbacks but accepts changed values and a new BFCache metric instance", async () => {
    const { setObservabilityTransport } = await start();
    const reports = vi.fn();
    setObservabilityTransport(reports);
    emit(metric("CLS", 0.1));
    emit(metric("CLS", 0.1, { delta: 0 }));
    emit(metric("CLS", 0.2, { delta: 0.1 }));
    emit(
      metric("CLS", 0.2, {
        id: "restored-visit",
        navigationType: "back-forward-cache",
      }),
    );
    expect(reports.mock.calls.map(([value]) => value.value)).toEqual([
      0.1, 0.2, 0.2,
    ]);
  });

  it("has a fixed payload with no metric ID, URL, DOM entries, account data or arbitrary attributes", async () => {
    const { setObservabilityTransport } = await start();
    const reports = vi.fn();
    setObservabilityTransport(reports);
    emit(
      Object.assign(metric("LCP", 123), {
        account: "private@example.test",
        id: "private-metric-id",
        navigationURL: "https://private.test/account?token=secret",
        entries: [{ name: "https://private.test/private-image" }],
      }),
    );
    const payload = reports.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      "delta",
      "metric",
      "name",
      "rating",
      "release",
      "timestamp",
      "unit",
      "value",
    ]);
    expect(Object.isFrozen(payload)).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/private|secret|account/);
  });

  it("rejects nonfinite or invalid metrics and isolates throwing or rejected sinks", async () => {
    const { setObservabilityTransport } = await start();
    const reports = vi.fn();
    setObservabilityTransport(reports);
    emit(metric("INP", Number.NaN));
    emit(metric("CLS", -0.1));
    emit(metric("TTFB", 1, { delta: Infinity }));
    emit(metric("LCP", 1, { rating: "private" as Metric["rating"] }));
    expect(reports).not.toHaveBeenCalled();
    setObservabilityTransport(() => {
      throw new Error("optional sink failed");
    });
    expect(() => emit(metric("INP", 100))).not.toThrow();
    setObservabilityTransport(() =>
      Promise.reject(new Error("optional sink rejected")),
    );
    emit(metric("INP", 110));
    await Promise.resolve();
    await Promise.resolve();
    setObservabilityTransport(reports);
    emit(metric("INP", 120));
    expect(reports).toHaveBeenCalledOnce();
  });

  it("never sends metrics without an explicitly configured transport", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await start();
    emit(metric("CLS", 0.1));
    emit(metric("INP", 180));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps unsupported browsers usable without installing metric observers", async () => {
    globalThis.PerformanceObserver =
      undefined as unknown as typeof PerformanceObserver;
    await start();
    for (const registration of Object.values(registrations))
      expect(registration).not.toHaveBeenCalled();
  });
});
