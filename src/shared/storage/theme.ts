import { defaultTheme, storageKeys } from "@/shared/config";

import type { Theme } from "@/shared/contracts";
import { getState, setState } from "./state";

export const getTheme = (): Theme => {
  const stored = getState<unknown>(storageKeys.theme, defaultTheme);
  return stored === "dark" || stored === "light" ? stored : defaultTheme;
};

export const setTheme = (theme: Theme) => {
  setState(storageKeys.theme, theme);
};
