import { storageKeys } from "../config/constants.ts";
import { defaultTheme } from "../config/theme.ts";
import type { Theme } from "../contracts/appearance.ts";
import { getState, setState } from "./state";

export const getTheme = (): Theme => {
  const stored = getState<unknown>(storageKeys.theme, defaultTheme);
  return stored === "dark" || stored === "light" ? stored : defaultTheme;
};

export const setTheme = (theme: Theme) => {
  setState(storageKeys.theme, theme);
};
