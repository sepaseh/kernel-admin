import { createContext } from "react";

import type { RouteKey } from "@/app/config";
import type { Settings } from "@/features/settings";
import type { ApplicationLanguage } from "@/features/settings/types";
import type { Theme } from "@/shared/contracts";

export type CoreContextValue = {
  compact: boolean;
  currentRoute: RouteKey;
  language: ApplicationLanguage;
  logos?: Record<Theme, string>;
  setCompact: (compact: boolean) => void;
  setCurrentRoute: (route: RouteKey) => void;
  setSettings: (settings: Settings) => void;
  setTheme: (theme: Theme) => void;
  settings: Settings;
  theme: Theme;
};

export const CoreContext = createContext<CoreContextValue | undefined>(
  undefined,
);
