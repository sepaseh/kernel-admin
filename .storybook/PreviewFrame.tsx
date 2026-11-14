import { useLayoutEffect, useMemo, type PropsWithChildren } from "react";
import { CoreContext } from "@/app/contexts";
import { AntdProvider } from "@/app/providers";
import { GlobalStyle } from "@/GlobalStyle";
import { dayjsLocaleName, i18n } from "@/shared/i18n";
import dayjs from "dayjs";
import { sampleSettings } from "./fixtures";

type PreviewFrameProps = PropsWithChildren<{
  languageCode: "en" | "fa";
  themeMode: "light" | "dark";
  compact: boolean;
  direction?: "ltr" | "rtl";
  ownsMain?: boolean;
}>;

export const PreviewFrame = ({
  children,
  compact,
  direction,
  languageCode,
  ownsMain,
  themeMode,
}: PreviewFrameProps) => {
  const Frame = ownsMain ? "div" : "main";
  const settings = useMemo(
    () => ({
      ...sampleSettings,
      language:
        languageCode === "fa"
          ? {
              code: "fa" as const,
              name: "Persian",
              nativeName: "فارسی",
              direction: direction ?? "rtl",
              calendar: "jalali" as const,
            }
          : {
              ...sampleSettings.language,
              direction: direction ?? sampleSettings.language.direction,
            },
    }),
    [direction, languageCode],
  );

  useLayoutEffect(() => {
    void i18n.changeLanguage(languageCode);
    dayjs.calendar(settings.language.calendar);
    dayjs.locale(dayjsLocaleName(languageCode));
  }, [languageCode, settings.language.calendar]);

  return (
    <CoreContext
      value={{
        compact,
        currentRoute: "root",
        settings,
        theme: themeMode,
        setCompact: () => undefined,
        setCurrentRoute: () => undefined,
        setSettings: () => undefined,
        setTheme: () => undefined,
      }}
    >
      <AntdProvider>
        <GlobalStyle />
        <Frame data-story-frame style={{ minHeight: "100vh", padding: 24 }}>
          {children}
        </Frame>
      </AntdProvider>
    </CoreContext>
  );
};
