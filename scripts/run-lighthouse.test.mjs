import { describe, expect, it } from "vitest";

import {
  createLighthouseUrl,
  evaluateLighthouseReport,
  lighthouseThresholds,
  minimumPerformanceScore,
} from "./lighthouse-policy.mjs";

const createReport = ({
  audits = {},
  score = minimumPerformanceScore,
} = {}) => ({
  audits: Object.fromEntries(
    Object.entries(lighthouseThresholds).map(([auditId, maximum]) => [
      auditId,
      { numericValue: audits[auditId] ?? maximum },
    ]),
  ),
  categories: { performance: { score } },
});

describe("Lighthouse advisory", () => {
  it.each([
    [undefined, "http://127.0.0.1:4174/auth"],
    ["/", "http://127.0.0.1:4174/auth"],
    ["/admin/", "http://127.0.0.1:4174/admin/auth"],
  ])("builds the authentication URL for base path %s", (basePath, url) => {
    expect(createLighthouseUrl(basePath)).toBe(url);
  });

  it("accepts a report at the advisory boundaries", () => {
    expect(evaluateLighthouseReport(createReport())).toBe(60);
  });

  it("reports the score and every audit that exceeds its threshold", () => {
    expect(() =>
      evaluateLighthouseReport(
        createReport({
          audits: {
            "first-contentful-paint": 6_001,
            "largest-contentful-paint": 6_501,
          },
          score: 0.599,
        }),
      ),
    ).toThrow(
      /performance score 59\.90 \(minimum 60\.00\).*first-contentful-paint 6001\.00.*largest-contentful-paint 6501\.00/s,
    );
  });

  it("keeps the successful score rounded to a whole percentage", () => {
    expect(evaluateLighthouseReport(createReport({ score: 0.604 }))).toBe(60);
    expect(evaluateLighthouseReport(createReport({ score: 0.606 }))).toBe(61);
  });

  it("rejects a below-threshold score even when its diagnostic rounds to the minimum", () => {
    expect(() =>
      evaluateLighthouseReport(createReport({ score: 0.59999 })),
    ).toThrow("performance score 60.00 (minimum 60.00)");
  });

  it.each([
    ["missing report", undefined],
    ["null report", null],
    ["missing categories", { audits: createReport().audits }],
    ["null categories", { ...createReport(), categories: null }],
    ["missing performance", { ...createReport(), categories: {} }],
    [
      "null performance",
      { ...createReport(), categories: { performance: null } },
    ],
  ])("reports an unavailable performance score for %s", (_, report) => {
    expect(() => evaluateLighthouseReport(report)).toThrow(
      "performance score unavailable (expected a finite number between 0 and 1)",
    );
  });

  it.each([
    ["missing audits", { categories: createReport().categories }],
    ["null audits", { ...createReport(), audits: null }],
  ])("reports every required metric as unavailable for %s", (_, report) => {
    expect(() => evaluateLighthouseReport(report)).toThrow(
      /Lighthouse advisory thresholds exceeded:\n.*cumulative-layout-shift unavailable.*first-contentful-paint unavailable.*interactive unavailable.*largest-contentful-paint unavailable.*total-blocking-time unavailable/s,
    );
  });

  it("reports an unavailable required audit instead of crashing", () => {
    const report = createReport();
    delete report.audits.interactive;

    expect(() => evaluateLighthouseReport(report)).toThrow(
      "interactive unavailable",
    );
  });

  it.each([null, undefined, Number.NaN, Infinity, -Infinity, "0.9", {}, 1.01])(
    "rejects an invalid performance score %s",
    (score) => {
      const report = createReport();
      report.categories.performance.score = score;
      expect(() => evaluateLighthouseReport(report)).toThrow();
    },
  );

  it.each([null, undefined, Number.NaN, Infinity, -Infinity, "1", {}, -1])(
    "rejects an invalid required metric %s",
    (value) => {
      const report = createReport();
      report.audits.interactive.numericValue = value;
      expect(() => evaluateLighthouseReport(report)).toThrow();
    },
  );

  it("accepts a perfect finite score and zero-valued measurements", () => {
    expect(
      evaluateLighthouseReport(
        createReport({
          score: 1,
          audits: {
            "cumulative-layout-shift": 0,
            "first-contentful-paint": 0,
            interactive: 0,
            "largest-contentful-paint": 0,
            "total-blocking-time": 0,
          },
        }),
      ),
    ).toBe(100);
  });

  it.each([
    "\\outside.example/",
    "/\\outside.example/",
    "//outside.example/",
    "/../",
    "/%2foutside/",
  ])(
    "rejects a noncanonical base path without changing its loopback origin: %s",
    (basePath) =>
      expect(() => createLighthouseUrl(basePath)).toThrow(/Base path/),
  );
});
