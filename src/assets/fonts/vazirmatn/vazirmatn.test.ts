import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

type Font = {
  copyright: string;
  familyName: string;
  glyphForCodePoint: (code: number) => { path: { toSVG: () => string } };
  hasGlyphForCodePoint: (code: number) => boolean;
  variationAxes: { wght: { default: number; max: number; min: number } };
};
const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as {
  create: (data: Buffer) => Font;
};
const read = (file: string) =>
  readFileSync(path.join(import.meta.dirname, file));
const fontFile = "Vazirmatn-Variable.woff2";
const licenseFile = "OFL.txt";
const identities = {
  [licenseFile]:
    "e6f4ce7b6c830d5a25a4f8ac777c267cd7d3c180bc2a7150ca57cbb9b280c4b7",
  [fontFile]:
    "4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92",
};

describe("published Vazirmatn font", () => {
  it("retains the reviewed bytes of the font and its license", () => {
    for (const [file, digest] of Object.entries(identities))
      expect(createHash("sha256").update(read(file)).digest("hex")).toBe(
        digest,
      );
    const font = fontkit.create(read(fontFile));
    const license = read(licenseFile).toString();
    expect(license).toContain(font.copyright);
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it("decodes the WOFF2 weight axis and real Persian/Latin default outlines", () => {
    const bytes = read(fontFile);
    expect(bytes.subarray(0, 4).toString()).toBe("wOF2");
    const font = fontkit.create(bytes);
    expect(font.familyName).toBe("Vazirmatn");
    expect(font.variationAxes.wght).toMatchObject({
      default: 400,
      max: 900,
      min: 100,
    });
    for (const character of "پارسی۰۱۲۳۴۵۶۷۸۹Admin0123456789") {
      expect(font.hasGlyphForCodePoint(character.codePointAt(0)!)).toBe(true);
      expect(
        font.glyphForCodePoint(character.codePointAt(0)!).path.toSVG().length,
      ).toBeGreaterThan(0);
    }
    expect(() => fontkit.create(Buffer.from("invalid font"))).toThrow();
  });
});
