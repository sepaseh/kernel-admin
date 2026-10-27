import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { MemoryRouter } from "react-router";

import type { CoreContextValue } from "@/app/contexts";
import { CoreContext } from "@/app/contexts";
import { AntdProvider } from "@/app/providers";
import type { Account } from "@/features/account";
import type { ApplicationLanguage } from "@/features/settings/types";
import type { Theme } from "@/shared/config";

import { sampleAccount, sampleLanguages } from "./fixtures";

type StoryShellProps = {
  children: ReactNode;
  initialEntries?: string[];
  initialLanguage?: ApplicationLanguage;
  initialTheme?: Theme;
  initialUser?: Account;
  withUser?: boolean;
};

export const StoryShell = ({
  children,
  initialEntries = ["/"],
  initialLanguage = sampleLanguages.en,
  initialTheme = "light",
  initialUser = sampleAccount,
  withUser = true,
}: StoryShellProps) => {
  const [compact, setCompact] = useState(false);
  const [language, setLanguage] = useState(initialLanguage);
  const [logos, setLogos] = useState<CoreContextValue["logos"]>();
  const [theme, setTheme] = useState(initialTheme);
  const [themePalettes, setThemePalettes] =
    useState<CoreContextValue["themePalettes"]>();
  const [user, setUser] = useState<CoreContextValue["user"]>(
    withUser ? initialUser : undefined,
  );
  const value = useMemo<CoreContextValue>(
    () => ({
      acceptSettings: (settings) => {
        setLanguage(settings.language);
        setLogos({
          dark: settings.darkLogo?.url ?? "/logo.svg",
          light: settings.lightLogo?.url ?? "/logo.svg",
        });
        setThemePalettes({
          dark: settings.darkTheme,
          light: settings.lightTheme,
        });
      },
      retrySettings: () => undefined,
      settingsLoading: false,
      compact,
      currentRoute: "root",
      language,
      logos,
      setCompact,
      setCurrentRoute: () => undefined,
      setLogos,
      setTheme,
      setThemePalettes,
      setUser,
      theme,
      themePalettes,
      user,
    }),
    [compact, language, logos, theme, themePalettes, user],
  );

  return (
    <CoreContext.Provider value={value}>
      <AntdProvider>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </AntdProvider>
    </CoreContext.Provider>
  );
};
