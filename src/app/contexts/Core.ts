import { createContext } from "react";

import type { RouteKey } from "@/app/config/routes";
import { type Account } from "@/features/account/types";
import type { ApplicationSettings } from "@/features/settings/types";
import type { Theme, ThemePalettes } from "@/shared/contracts/appearance";

export type CoreContextValue = {
  acceptSettings: (settings: ApplicationSettings) => void;
  compact: boolean;
  currentRoute: RouteKey;
  language: ApplicationSettings["language"];
  logos?: Record<Theme, string>;
  retrySettings: () => unknown;
  settingsError?: unknown;
  settingsLoading: boolean;
  setCompact: (compact: boolean) => void;
  setCurrentRoute: (route: RouteKey) => void;
  setLogos: (logos: Record<Theme, string>) => void;
  setTheme: (theme: Theme) => void;
  setThemePalettes: (themePalettes: ThemePalettes) => void;
  setUser: (user?: Account) => void;
  theme: Theme;
  themePalettes?: ThemePalettes;
  user?: Account;
};

export const CoreContext = createContext<CoreContextValue | undefined>(
  undefined,
);
