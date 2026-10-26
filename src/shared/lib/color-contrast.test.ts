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
  it("accepts supported hex and comma RGB forms with consistent alpha compositing", () => {
    expect(contrastRatio(" #AbC ", "#fff")).toBe(
      contrastRatio("rgb(170, 187, 204)", "#ffffff"),
    );
    expect(contrastRatio("#0008", "#fff")).toBe(
      contrastRatio("#00000088", "#fff"),
    );
    expect(contrastRatio("#00000080", "#fff")).toBe(
      contrastRatio(`rgba(0, 0, 0, ${128 / 255})`, "#fff"),
    );
    expect(contrastRatio("RGB(0, 0, 0)", "#fff")).toBe(21);
    expect(contrastRatio("rgba(0, 0, 0, .5)", "#fff")).toBe(
      contrastRatio("rgb(127.5, 127.5, 127.5)", "#fff"),
    );
  });
  it.each([
    "hsl(0, 0%, 50%)",
    "rebeccapurple",
    "transparent",
    "garbage 1 2 3",
    "#12345",
    "rgb(0, 0)",
    "rgb(0, 0, 0, 1)",
    "rgba(0, 0, 0)",
    "rgb(256, 0, 0)",
    "rgb(-1, 0, 0)",
    "rgb(0, NaN, 0)",
    "rgb(0, 0, Infinity)",
    "rgba(0, 0, 0, 1.01)",
    "rgba(0, 0, 0, -0.1)",
    "rgb(100%, 0%, 0%)",
    "rgb(0 0 0)",
    "rgb(0, 0, 0) trailing",
  ])("rejects unsupported or malformed input %s", (color) => {
    expect(() => contrastRatio(color, "#fff")).toThrow(TypeError);
    expect(() => contrastRatio("#000", color)).toThrow(TypeError);
  });
  it.each(["#ffffff", "#000000"])(
    "finds a feasible narrow shade against black and white from %s",
    (color) => {
      const surfaces = ["#000000", "#ffffff"];
      const fill = ensureContrast(color, surfaces);
      for (const surface of surfaces)
        expect(contrastRatio(fill, surface)).toBeGreaterThanOrEqual(4.5);
    },
  );
  it("keeps the chosen hue when a darker shade meets the requested contrast", () => {
    const fill = ensureContrast("#00ff00", ["#ffffff"]);
    expect(fill).toMatch(/^#00[\da-f]{2}00$/);
    expect(contrastRatio(fill, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("returns the best available shade when the requested contrast is impossible", () => {
    const surfaces = ["#000000", "#ffffff"];
    const fill = ensureContrast("#ffffff", surfaces, 7);
    const minimum = Math.min(
      ...surfaces.map((surface) => contrastRatio(fill, surface)),
    );
    expect(minimum).toBeGreaterThanOrEqual(4.5);
    expect(minimum).toBeLessThan(7);
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
