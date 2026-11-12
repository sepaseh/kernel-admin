import { describe, expect, it } from "vitest";

import {
  evaluateBundleAssets,
  maximumChunkBytes,
  maximumTotalBytes,
} from "./check-bundle-size.mjs";

describe("bundle size budgets", () => {
  it("returns the total and largest JavaScript asset", () => {
    expect(
      evaluateBundleAssets([
        { bytes: 100, name: "small.js" },
        { bytes: 200, name: "large.js" },
      ]),
    ).toEqual({
      largestAsset: { bytes: 200, name: "large.js" },
      totalBytes: 300,
      findings: [],
    });
  });

  it("rejects an empty asset list", () => {
    expect(() => evaluateBundleAssets([])).toThrow("No JavaScript assets");
  });

  it("reports an oversized chunk as advisory", () => {
    expect(
      evaluateBundleAssets([{ bytes: maximumChunkBytes + 1, name: "app.js" }])
        .findings,
    ).toEqual([expect.stringContaining("app.js")]);
  });

  it("reports an oversized total as advisory", () => {
    expect(
      evaluateBundleAssets([
        { bytes: maximumTotalBytes / 2 + 1, name: "a.js" },
        { bytes: maximumTotalBytes / 2, name: "b.js" },
      ]).findings,
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("Total JavaScript")]),
    );
  });
});
