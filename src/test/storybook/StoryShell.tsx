import "@/shared/i18n/date";

import { theme as antdTheme } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import { MemoryRouter } from "react-router";

import type { RouteKey } from "@/app/config/routes";
import type { CoreContextValue } from "@/app/contexts";
import { CoreContext } from "@/app/contexts";
import { AntdProvider } from "@/app/providers";
import type { Account } from "@/features/account";
import type { ApplicationLanguage } from "@/features/settings/types";
import type { Theme } from "@/shared/config";
import { i18nInstance } from "@/shared/i18n";

import { sampleAccount, sampleLanguages } from "./fixtures";
import { StoryAppearanceContext } from "./StoryAppearance";

type StoryShellProps = {
  children: ReactNode;
  initialEntries?: string[];
  initialLanguage?: ApplicationLanguage;
  initialTheme?: Theme;
  initialUser?: Account;
  withUser?: boolean;
};

const StorySurface = ({
  children,
  language,
}: {
  children: ReactNode;
  language: ApplicationLanguage;
}) => {
  const { token } = antdTheme.useToken();

  return (
    <div
      dir={language.direction}
      lang={language.code}
      style={{
        backgroundColor: token.colorBgBase,
        color: token.colorTextBase,
        minHeight: "100vh",
      }}
    >
      {children}
    </div>
  );
};

export const StoryShell = ({
  children,
  initialEntries = ["/"],
  initialLanguage = sampleLanguages.en,
  initialTheme = "light",
  initialUser = sampleAccount,
  withUser = true,
}: StoryShellProps) => {
  const appearance = useContext(StoryAppearanceContext);
  const [compact, setCompact] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<RouteKey>("root");
  const [language, setLanguage] = useState(
    appearance?.language ?? initialLanguage,
  );
  const [toolbarLanguage, setToolbarLanguage] = useState(appearance?.language);
  const [logos, setLogos] = useState<CoreContextValue["logos"]>();
  const [theme, setTheme] = useState(appearance?.theme ?? initialTheme);
  const [toolbarTheme, setToolbarTheme] = useState(appearance?.theme);
  const [themePalettes, setThemePalettes] =
    useState<CoreContextValue["themePalettes"]>();
  const [user, setUser] = useState<CoreContextValue["user"]>(
    withUser ? initialUser : undefined,
  );
  if (toolbarLanguage !== appearance?.language) {
    setToolbarLanguage(appearance?.language);
    if (appearance) setLanguage(appearance.language);
  }
  if (toolbarTheme !== appearance?.theme) {
    setToolbarTheme(appearance?.theme);
    if (appearance) setTheme(appearance.theme);
  }
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
      currentRoute,
      language,
      logos,
      setCompact,
      setCurrentRoute,
      setLogos,
      setTheme,
      setThemePalettes,
      setUser,
      theme,
      themePalettes,
      user,
    }),
    [compact, currentRoute, language, logos, theme, themePalettes, user],
  );

  useEffect(() => {
    void i18nInstance.changeLanguage(language.code);
    dayjs.calendar(
      language.calendar === "gregorian" ? "gregory" : language.calendar,
    );
    dayjs.locale(language.code === "en" ? "en-gb" : language.code);
  }, [language.calendar, language.code]);

  return (
    <CoreContext.Provider value={value}>
      <AntdProvider>
        <StorySurface language={language}>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </StorySurface>
      </AntdProvider>
    </CoreContext.Provider>
  );
};
