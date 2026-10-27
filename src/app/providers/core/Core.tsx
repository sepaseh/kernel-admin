import "@/shared/i18n/date";

import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { RouteKey } from "@/app/config";
import type { CoreContextValue } from "@/app/contexts";
import { CoreContext } from "@/app/contexts";
import { fetchApplicationSettings } from "@/features/settings/api";
import type { ApplicationSettings } from "@/features/settings/types";
import type { Theme } from "@/shared/contracts/appearance";
import { defaultLanguage, defaultLogos, storageKeys } from "@/shared/config";
import { useReadResource } from "@/shared/hooks";
import { i18nInstance } from "@/shared/i18n";
import {
  getCompact,
  getTheme,
  setCompact as setCompactStorage,
  setTheme as setThemeStorage,
  useLocalStorageWatcher,
} from "@/shared/storage";

type CoreProviderProps = {
  children: ReactNode;
};

const bootstrapLanguage: ApplicationSettings["language"] = {
  calendar: "jalali",
  code: defaultLanguage,
  direction: "rtl",
  name: "Persian",
  nativeName: "فارسی",
};

export const CoreProvider = ({ children }: CoreProviderProps) => {
  const [compact, setCompact] = useState(getCompact);
  const [currentRoute, setCurrentRoute] = useState<RouteKey>("root");
  const [language, setLanguage] = useState(bootstrapLanguage);
  const [logos, setLogos] = useState<CoreContextValue["logos"]>(defaultLogos);
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [themePalettes, setThemePalettes] =
    useState<CoreContextValue["themePalettes"]>();
  const [user, setUser] = useState<CoreContextValue["user"]>();

  const applySettings = useCallback((value: ApplicationSettings) => {
    setLanguage(value.language);
    setLogos({
      dark: value.darkLogo?.url ?? defaultLogos.dark,
      light: value.lightLogo?.url ?? defaultLogos.light,
    });
    setThemePalettes({ dark: value.darkTheme, light: value.lightTheme });
  }, []);
  const loadSettings = useCallback(
    async (signal: AbortSignal) => {
      const value = await fetchApplicationSettings(signal);
      if (!signal.aborted) applySettings(value);
      return value;
    },
    [applySettings],
  );
  const {
    error: settingsError,
    loading: settingsLoading,
    reload: reloadSettings,
    replace: replaceSettings,
  } = useReadResource(loadSettings);
  const acceptSettings = useCallback(
    (value: ApplicationSettings) => {
      replaceSettings(value);
      applySettings(value);
    },
    [applySettings, replaceSettings],
  );

  const changeTheme = useCallback((theme: Theme, fromStorage?: boolean) => {
    if (!fromStorage) setThemeStorage(theme);
    setTheme(theme);
  }, []);

  const changeCompact = useCallback(
    (compact: boolean, fromStorage?: boolean) => {
      if (!fromStorage) setCompactStorage(compact);
      setCompact(compact);
    },
    [],
  );

  useLocalStorageWatcher(storageKeys.compact, () => {
    changeCompact(getCompact(), true);
  });

  useLocalStorageWatcher(storageKeys.theme, () => {
    changeTheme(getTheme(), true);
  });

  const value = useMemo<CoreContextValue>(
    () => ({
      acceptSettings,
      compact,
      currentRoute,
      language,
      logos,
      retrySettings: reloadSettings,
      settingsError,
      settingsLoading,
      setCompact: changeCompact,
      setCurrentRoute,
      setLogos,
      setTheme: changeTheme,
      setThemePalettes,
      setUser,
      theme,
      themePalettes,
      user,
    }),
    [
      acceptSettings,
      changeCompact,
      changeTheme,
      compact,
      currentRoute,
      language,
      logos,
      reloadSettings,
      settingsError,
      settingsLoading,
      theme,
      themePalettes,
      user,
    ],
  );

  useEffect(() => {
    void i18nInstance.changeLanguage(language.code);
    dayjs.calendar(
      language.calendar === "gregorian" ? "gregory" : language.calendar,
    );
    dayjs.locale(language.code === "en" ? "en-gb" : language.code);
  }, [language.calendar, language.code]);

  useEffect(() => {
    const refreshOnFocus = () => {
      void reloadSettings();
    };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [reloadSettings]);

  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
};
