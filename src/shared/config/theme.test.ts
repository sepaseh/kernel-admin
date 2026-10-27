import { theme as antdTheme } from "antd";
import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/shared/lib/color-contrast";

import { brandPrimaryColor, createThemeConfig } from "./theme";

describe("accessible default Ant Design theme", () => {
  for (const mode of ["light", "dark"] as const) {
    it.each([false, true])(
      `${mode}, compact=%s keeps brand and readable displayed controls`,
      (compact) => {
        const config = createThemeConfig(mode, compact);
        const token = antdTheme.getDesignToken(config);
        const components = config.components!;
        expect(config.token!.colorPrimary).toBe(brandPrimaryColor);
        expect(
          contrastRatio(components.Button!.primaryColor!, token.colorPrimary),
        ).toBeGreaterThanOrEqual(4.5);
        for (const surface of [token.colorBgContainer, token.colorBgLayout]) {
          expect(
            contrastRatio(config.token!.colorTextDescription!, surface),
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrastRatio(components.Form!.colorError!, surface),
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrastRatio(components.Input!.colorBorder!, surface),
          ).toBeGreaterThanOrEqual(3);
          for (const fill of [
            components.Checkbox!.colorPrimary!,
            components.Radio!.colorPrimary!,
            components.Switch!.colorPrimary!,
            components.Switch!.colorTextQuaternary!,
          ]) {
            expect(contrastRatio(fill, surface)).toBeGreaterThanOrEqual(3);
            expect(contrastRatio("#ffffff", fill)).toBeGreaterThanOrEqual(3);
          }
        }
      },
    );
  }
});
