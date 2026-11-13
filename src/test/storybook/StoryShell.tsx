import "@/shared/i18n/date";

import { theme as antdTheme } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useContext, useEffect, useState } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";

import type { RouteKey } from "@/app/config/routes";
import { CoreContext, type CoreContextValue } from "@/app/contexts";
import { AntdProvider } from "@/app/providers";
import type { Account } from "@/features/account";
import type { ApplicationLanguage, Settings } from "@/features/settings/types";
import type { DefaultLayoutContext } from "@/layouts/default";
import { defaultLogos } from "@/shared/config";
import type { Theme } from "@/shared/contracts";
import { dayjsLocaleName, i18n } from "@/shared/i18n";

import { sampleAccount, sampleLanguages, sampleSettings } from "./fixtures";
import { StoryAppearanceContext } from "./StoryAppearance";

type StoryShellProps = {
  children: ReactNode;
  initialEntries?: string[];
  initialLanguage?: ApplicationLanguage;
  initialTheme?: Theme;
  initialUser?: Account;
  withUser?: boolean;
};

type StorySurfaceProps = {
  children: ReactNode;
  language: Settings["language"];
};

const StorySurface = ({ children, language }: StorySurfaceProps) => {
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

const settingsLanguage = (
  language: ApplicationLanguage,
): Settings["language"] => ({
  ...language,
  calendar: language.calendar === "gregorian" ? "gregory" : language.calendar,
});

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
  const [settings, setSettings] = useState<Settings>(() => ({
    ...structuredClone(sampleSettings),
    language: settingsLanguage(appearance?.language ?? initialLanguage),
  }));
  const [theme, setTheme] = useState(appearance?.theme ?? initialTheme);
  const [toolbarLanguage, setToolbarLanguage] = useState(appearance?.language);
  const [toolbarTheme, setToolbarTheme] = useState(appearance?.theme);
  const [user, setUser] = useState<CoreContextValue["user"]>(
    withUser ? initialUser : undefined,
  );
  if (toolbarLanguage !== appearance?.language) {
    setToolbarLanguage(appearance?.language);
    if (appearance)
      setSettings((current) => ({
        ...current,
        language: settingsLanguage(appearance.language),
      }));
  }
  if (toolbarTheme !== appearance?.theme) {
    setToolbarTheme(appearance?.theme);
    if (appearance) setTheme(appearance.theme);
  }
  const { language } = settings;
  const value: CoreContextValue = {
    compact,
    currentRoute,
    language,
    logos: {
      dark: settings.darkLogo?.url ?? defaultLogos.dark,
      light: settings.lightLogo?.url ?? defaultLogos.light,
    },
    setCompact,
    setCurrentRoute,
    setSettings,
    setTheme,
    setUser,
    settings,
    theme,
    user,
  };

  useEffect(() => {
    void i18n.changeLanguage(language.code);
    dayjs.calendar(language.calendar);
    dayjs.locale(dayjsLocaleName(language.code));
  }, [language.calendar, language.code]);

  return (
    <CoreContext.Provider value={value}>
      <AntdProvider>
        <StorySurface language={language}>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route
                element={
                  <Outlet
                    context={
                      user
                        ? ({
                            currentUser: user,
                            fetchCurrentUser: async () => undefined,
                            clearSession: () => setUser(undefined),
                          } satisfies DefaultLayoutContext)
                        : undefined
                    }
                  />
                }
              >
                <Route path="*" element={children} />
              </Route>
            </Routes>
          </MemoryRouter>
        </StorySurface>
      </AntdProvider>
    </CoreContext.Provider>
  );
};
