import "@/shared/i18n/date";

import { ConfigProvider, theme as antdTheme } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useLayoutEffect, useState } from "react";

import type { RouteKey } from "@/app/config/routes";
import { CoreContext, type CoreContextValue } from "@/app/contexts";
import { AntdProvider } from "@/app/providers";
import type { ApplicationLanguage, Settings } from "@/features/settings/types";
import { GlobalStyle } from "@/GlobalStyle";
import { defaultLogos } from "@/shared/config";
import type { Theme } from "@/shared/contracts";
import { dayjsLocaleName, i18n } from "@/shared/i18n";

import { sampleLanguages, sampleSettings } from "./fixtures";

type PreviewFrameProps = {
  children: ReactNode;
  compact?: boolean;
  direction?: "ltr" | "rtl";
  initialLanguage?: ApplicationLanguage;
  languageCode: "en" | "fa";
  ownsMain?: boolean;
  themeMode: Theme;
};

type StorySurfaceProps = {
  children: ReactNode;
  language: Settings["language"];
  ownsMain?: boolean;
};

const StorySurface = ({ children, language, ownsMain }: StorySurfaceProps) => {
  const { token } = antdTheme.useToken();
  const Frame = ownsMain ? "div" : "main";

  return (
    <Frame
      data-story-frame
      dir={language.direction}
      lang={language.code}
      style={{
        backgroundColor: token.colorBgBase,
        color: token.colorTextBase,
        minHeight: "100vh",
        padding: 24,
      }}
    >
      {children}
    </Frame>
  );
};

export const PreviewFrame = ({
  children,
  compact: toolbarCompact = false,
  direction,
  initialLanguage,
  languageCode,
  ownsMain,
  themeMode,
}: PreviewFrameProps) => {
  const language = initialLanguage ?? sampleLanguages[languageCode];
  const fixtureLanguage: Settings["language"] = {
    ...language,
    calendar: language.calendar === "gregorian" ? "gregory" : language.calendar,
    direction: direction ?? language.direction,
  };
  const languageKey = JSON.stringify(fixtureLanguage);
  const [compact, setCompact] = useState(toolbarCompact);
  const [currentRoute, setCurrentRoute] = useState<RouteKey>("root");
  const [settings, setSettings] = useState<Settings>(() => ({
    ...structuredClone(sampleSettings),
    language: fixtureLanguage,
  }));
  const [theme, setTheme] = useState(themeMode);
  const [previousCompact, setPreviousCompact] = useState(toolbarCompact);
  const [previousLanguage, setPreviousLanguage] = useState(languageKey);
  const [previousTheme, setPreviousTheme] = useState(themeMode);

  if (previousCompact !== toolbarCompact) {
    setPreviousCompact(toolbarCompact);
    setCompact(toolbarCompact);
  }
  if (previousLanguage !== languageKey) {
    setPreviousLanguage(languageKey);
    setSettings((current) => ({ ...current, language: fixtureLanguage }));
  }
  if (previousTheme !== themeMode) {
    setPreviousTheme(themeMode);
    setTheme(themeMode);
  }

  const value: CoreContextValue = {
    compact,
    currentRoute,
    language: settings.language,
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

  useLayoutEffect(() => {
    void i18n.changeLanguage(settings.language.code);
    dayjs.calendar(settings.language.calendar);
    dayjs.locale(dayjsLocaleName(settings.language.code));
  }, [settings.language.calendar, settings.language.code]);

  return (
    <CoreContext.Provider value={value}>
      <ConfigProvider theme={{ inherit: false }}>
        <AntdProvider>
          <GlobalStyle />
          <StorySurface language={settings.language} ownsMain={ownsMain}>
            {children}
          </StorySurface>
        </AntdProvider>
      </ConfigProvider>
    </CoreContext.Provider>
  );
};
