export type Theme = "dark" | "light";

export const themeColorFields = [
  "colorBgBase",
  "colorBgContainer",
  "colorBorder",
  "colorLink",
  "colorPrimary",
  "colorTextBase",
  "colorTextDescription",
] as const;

type ThemeColorField = (typeof themeColorFields)[number];

export type ThemeColors = Record<ThemeColorField, string>;
export type ThemePalettes = Record<Theme, ThemeColors>;
