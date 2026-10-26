import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  ensureContrast,
  readableTextColor,
} from "./color-contrast";

describe("displayed theme foregrounds", () => {
  it("finds a control fill readable against a white glyph and dark surrounding surfaces", () => {
    const surfaces = ["#141414", "#000000", "#ffffff"];
    const fill = ensureContrast("#55bcd8", surfaces, 3);
    for (const surface of surfaces)
      expect(contrastRatio(fill, surface)).toBeGreaterThanOrEqual(3);
  });
  it("uses the WCAG sRGB ratio and composites transparent foregrounds", () => {
    expect(contrastRatio("#000", "#fff")).toBe(21);
    expect(contrastRatio("#fff", "#fff")).toBe(1);
    expect(contrastRatio("rgba(0, 0, 0, 0.45)", "#fff")).toBeCloseTo(3.36, 2);
  });
  it.each(["#61dafb", "#55bcd8", "#654321", "#808080", "#ff4d4f"])(
    "chooses readable text against solid fill %s",
    (background) => {
      expect(
        contrastRatio(readableTextColor(background), background),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
  it("retains already readable custom text and makes faint accent/neutral shades readable", () => {
    expect(ensureContrast("#123456", ["#ffffff", "#f5f5f5"])).toBe("#123456");
    for (const surfaces of [
      ["#ffffff", "#f5f5f5"],
      ["#141414", "#000000"],
    ]) {
      for (const color of [
        "#61dafb",
        "rgba(0, 0, 0, 0.45)",
        "rgba(255, 255, 255, 0.25)",
      ])
        for (const surface of surfaces)
          expect(
            contrastRatio(ensureContrast(color, surfaces), surface),
          ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
