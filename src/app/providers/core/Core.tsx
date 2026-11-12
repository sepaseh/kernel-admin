import { Button, Flex, Result, Spin } from "antd";
import dayjs from "dayjs";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { CoreContext, type CoreContextValue } from "@/app/contexts";
import { type Settings, fetchSettings } from "@/features/settings";
import { useAbortController } from "@/shared/hooks";
import { storageKeys } from "@/shared/config";
import { dayjsLocaleName, i18n } from "@/shared/i18n";
import {
  getCompact,
  getTheme,
  setCompact as saveCompact,
  setTheme as saveTheme,
  useLocalStorageWatcher,
} from "@/shared/storage";

export const CoreProvider = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  const [compact, setCompact] = useState(getCompact);
  const [currentRoute, setCurrentRoute] =
    useState<CoreContextValue["currentRoute"]>("root");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>();
  const [theme, setTheme] = useState(getTheme);
  const { cancel, start } = useAbortController();
  const language = settings?.language;

  const fetchData = useCallback(async () => {
    const signal = start();
    setLoading(true);

    try {
      const data = await fetchSettings(signal);
      if (signal.aborted) return;

      setSettings(data);
    } catch {
      // The provider offers an inline retry and keeps accepted settings.
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [start]);

  const changeSettings = useCallback(
    (value: Settings) => {
      cancel();
      setSettings(value);
      setLoading(false);
    },
    [cancel],
  );

  const changeCompact: CoreContextValue["setCompact"] = (value) => {
    saveCompact(value);
    setCompact(value);
  };

  const changeTheme: CoreContextValue["setTheme"] = (value) => {
    saveTheme(value);
    setTheme(value);
  };

  useLocalStorageWatcher(storageKeys.compact, () => setCompact(getCompact()));

  useLocalStorageWatcher(storageKeys.theme, () => setTheme(getTheme()));

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();

    return cancel;
  }, [cancel, fetchData]);

  useEffect(() => {
    if (!language) return;

    void i18n.changeLanguage(language.code);
    dayjs.calendar(language.calendar);
    dayjs.locale(dayjsLocaleName(language.code));
  }, [language]);

  if (!settings) {
    return (
      <Flex
        align="center"
        gap="middle"
        justify="center"
        style={{ minHeight: "100vh" }}
        vertical
      >
        {loading ? (
          <Spin
            aria-label={t("loading")}
            ref={(node) => node?.nativeElement.setAttribute("role", "status")}
          />
        ) : (
          <Result
            extra={
              <Button onClick={() => void fetchData()} type="primary">
                {t("retry")}
              </Button>
            }
            status="500"
            title={t("settingsLoadFailed")}
          />
        )}
      </Flex>
    );
  }

  return (
    <CoreContext.Provider
      value={{
        compact,
        currentRoute,
        settings,
        setCompact: changeCompact,
        setCurrentRoute,
        setSettings: changeSettings,
        setTheme: changeTheme,
        theme,
      }}
    >
      {children}
    </CoreContext.Provider>
  );
};
