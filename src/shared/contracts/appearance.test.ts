import { describe, expect, it } from "vitest";

import { themeColorFields, type ThemePalettes } from "./appearance.ts";

describe("shared appearance wire vocabulary", () => {
  it("covers every published branding color without carrying UI defaults or an SDK", () => {
    const colors = {
      colorBgBase: "#101010",
      colorBgContainer: "#202020",
      colorBorder: "#303030",
      colorLink: "#aabbcc",
      colorPrimary: "#abcdef",
      colorTextBase: "#ffffff",
      colorTextDescription: "#cccccc",
    } satisfies ThemePalettes["dark"];
    const palettes: ThemePalettes = {
      dark: colors,
      light: { ...colors, colorBgBase: "#ffffff" },
    };
    expect(new Set(themeColorFields).size).toBe(themeColorFields.length);
    for (const palette of Object.values(palettes))
      expect(Object.keys(palette).sort((a, b) => a.localeCompare(b))).toEqual(
        [...themeColorFields].sort((a, b) => a.localeCompare(b)),
      );
    expect(JSON.parse(JSON.stringify(palettes))).toEqual(palettes);
  });
});
