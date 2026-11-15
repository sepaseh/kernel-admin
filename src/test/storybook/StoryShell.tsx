import "@/shared/i18n/date";

import { ConfigProvider, theme as antdTheme } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useContext, useEffect, useState } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";

import type { RouteKey } from "@/app/config/routes";
import { CoreContext, type CoreContextValue } from "@/app/contexts";
import { AntdProvider } from "@/app/providers";
import type { CurrentUser } from "@/features/account";
import { fetchCurrentUser } from "@/features/account/api";
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
  initialUser?: CurrentUser;
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
  const [user, setUser] = useState<CurrentUser | undefined>(
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
    settings,
    theme,
  };

  useEffect(() => {
    void i18n.changeLanguage(language.code);
    dayjs.calendar(language.calendar);
    dayjs.locale(dayjsLocaleName(language.code));
  }, [language.calendar, language.code]);

  return (
    <CoreContext.Provider value={value}>
      <ConfigProvider theme={{ inherit: false }}>
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
                              fetchCurrentUser: async () => {
                                setUser(await fetchCurrentUser());
                              },
                              clearSession: () => setUser(undefined),
                            } satisfies DefaultLayoutContext)
                          : undefined
                      }
                    />
                  }
                >
                  <Route
                    element={
                      withUser && !user ? <div>Session cleared</div> : children
                    }
                    path="*"
                  />
                </Route>
              </Routes>
            </MemoryRouter>
          </StorySurface>
        </AntdProvider>
      </ConfigProvider>
    </CoreContext.Provider>
  );
};
