import type { Theme, ThemeColors } from "../contracts/appearance.ts";

export type { Theme, ThemePalettes } from "../contracts/appearance.ts";
export { themeColorFields } from "../contracts/appearance.ts";

export const brandPrimaryColor = "#61dafb";

export const defaultLogos: Record<Theme, string> = {
  dark: "/logo.svg",
  light: "/logo.svg",
};

export const defaultTheme: Theme = "dark";
import type { GlobalToken, ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

import { ensureContrast, readableTextColor } from "@/shared/lib/color-contrast";

const algorithms = {
  dark: antdTheme.darkAlgorithm,
  light: antdTheme.defaultAlgorithm,
};
const defaults = {
  dark: antdTheme.getDesignToken({ algorithm: algorithms.dark }),
  light: antdTheme.getDesignToken({ algorithm: algorithms.light }),
};
type Palette = ThemeColors & Pick<GlobalToken, "colorTextPlaceholder">;

export const createThemeConfig = (
  mode: Theme,
  compact = false,
  overrides?: ThemeColors,
): ThemeConfig => {
  const base = defaults[mode];
  const palette: Palette = {
    colorBgBase: base.colorBgBase,
    colorBgContainer: base.colorBgContainer,
    colorBorder: base.colorBorder,
    colorLink: base.colorLink,
    colorPrimary: brandPrimaryColor,
    colorTextBase: base.colorTextBase,
    colorTextDescription: base.colorTextDescription,
    colorTextPlaceholder: base.colorTextPlaceholder,
    ...overrides,
  };
  const algorithm = compact
    ? [algorithms[mode], antdTheme.compactAlgorithm]
    : algorithms[mode];
  const errorSeed =
    mode === "light" ? "#b42318" : antdTheme.defaultSeed.colorError;
  const derived = antdTheme.getDesignToken({
    algorithm,
    token: { ...palette, colorError: errorSeed },
  });
  const surfaces = [derived.colorBgContainer, derived.colorBgLayout];
  const secondaryText = ensureContrast(palette.colorTextDescription, surfaces);
  const accentText = ensureContrast(derived.colorPrimary, [
    ...surfaces,
    derived.colorPrimaryBg,
  ]);
  const controlBorder = ensureContrast(palette.colorBorder, surfaces, 3);
  // Checkmarks and radio dots are white inside these AntD controls. Keep
  // the brand seed intact and adjust only their small interactive fills.
  const controlSurfaces = [...surfaces, "#ffffff"];
  const controlPrimary = ensureContrast(
    derived.colorPrimary,
    controlSurfaces,
    3,
  );
  const controlPrimaryHover = ensureContrast(
    derived.colorPrimaryHover,
    controlSurfaces,
    3,
  );
  const floatPrimary = mode === "light" ? "#237804" : derived.colorSuccess;
  return {
    algorithm,
    token: {
      ...palette,
      colorTextDescription: secondaryText,
      colorTextTertiary: secondaryText,
      colorTextPlaceholder: ensureContrast(
        palette.colorTextPlaceholder,
        surfaces,
      ),
      colorLink: ensureContrast(palette.colorLink, surfaces),
      colorIcon: secondaryText,
      colorError: errorSeed,
      colorErrorText: ensureContrast(derived.colorErrorText, surfaces),
      colorErrorTextHover: ensureContrast(
        derived.colorErrorTextHover,
        surfaces,
      ),
      colorErrorTextActive: ensureContrast(
        derived.colorErrorTextActive,
        surfaces,
      ),
      colorErrorBorder: ensureContrast(derived.colorErrorBorder, surfaces, 3),
      fontFamily: "inherit",
      colorBgElevated: palette.colorBgContainer,
      screenXLMax: 1399,
      screenXXL: 1400,
      screenXXLMin: 1400,
    },
    components: {
      Badge: { dotSize: 12 },
      Breadcrumb: { itemColor: secondaryText, linkColor: secondaryText },
      Button: {
        primaryColor: readableTextColor(derived.colorPrimary),
        dangerColor: readableTextColor(derived.colorError),
        defaultBorderColor: controlBorder,
      },
      Checkbox: {
        colorBorder: controlBorder,
        colorPrimary: controlPrimary,
        colorPrimaryHover: controlPrimaryHover,
      },
      Divider: { marginLG: 0 },
      Empty: { colorTextDescription: secondaryText },
      Form: { colorError: ensureContrast(derived.colorError, surfaces) },
      FloatButton: {
        colorPrimary: floatPrimary,
        colorPrimaryActive:
          mode === "light" ? "#092b00" : derived.colorSuccessActive,
        colorPrimaryHover:
          mode === "light" ? "#135200" : derived.colorSuccessHover,
        colorTextLightSolid: readableTextColor(floatPrimary),
      },
      Input: { colorBorder: controlBorder },
      Pagination: {
        itemActiveColor: ensureContrast(derived.colorPrimary, surfaces),
        itemActiveColorHover: ensureContrast(
          derived.colorPrimaryHover,
          surfaces,
        ),
      },
      Select: {
        colorBorder: controlBorder,
        colorTextQuaternary: secondaryText,
      },
      Radio: {
        buttonSolidCheckedColor: readableTextColor(controlPrimary),
        colorBorder: controlBorder,
        colorPrimary: controlPrimary,
        colorPrimaryHover: controlPrimaryHover,
      },
      Switch: {
        colorPrimary: controlPrimary,
        colorPrimaryHover: controlPrimaryHover,
        colorTextQuaternary: ensureContrast(
          derived.colorTextQuaternary,
          controlSurfaces,
          3,
        ),
        colorTextTertiary: ensureContrast(
          derived.colorTextTertiary,
          controlSurfaces,
          3,
        ),
        colorTextLightSolid: readableTextColor(controlPrimary),
      },
      Menu: {
        colorBgContainer: "transparent",
        colorSplit: "transparent",
        itemPaddingInline: 8,
        itemSelectedColor: accentText,
        horizontalItemSelectedColor: accentText,
        subMenuItemSelectedColor: accentText,
      },
    },
  };
};
