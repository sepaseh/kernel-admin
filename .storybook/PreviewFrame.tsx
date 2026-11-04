import "@/shared/i18n/date";

import { ConfigProvider } from "antd";
import en from "antd/locale/en_GB";
import fa from "antd/locale/fa_IR";
import dayjs from "dayjs";
import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useMemo } from "react";

import { createThemeConfig } from "@/shared/config";
import { i18nInstance } from "@/shared/i18n";
import { sampleLanguages } from "@/test/storybook/fixtures";
import { StoryAppearanceContext } from "@/test/storybook/StoryAppearance";

type PreviewFrameProps = {
  children: ReactNode;
  direction: "ltr" | "rtl";
  languageCode: "en" | "fa";
  themeMode: "dark" | "light";
};

export const PreviewFrame = ({
  children,
  direction,
  languageCode,
  themeMode,
}: PreviewFrameProps) => {
  const language = useMemo(
    () => ({ ...sampleLanguages[languageCode], direction }),
    [direction, languageCode],
  );
  const appearance = useMemo(
    () => ({ language, theme: themeMode }),
    [language, themeMode],
  );
  const themeConfig = useMemo(() => createThemeConfig(themeMode), [themeMode]);
  const frameStyle: CSSProperties & { "--admin-focus-color": string } = {
    "--admin-focus-color": String(themeConfig.token?.colorTextBase),
    backgroundColor: String(themeConfig.token?.colorBgBase),
    color: String(themeConfig.token?.colorTextBase),
    minHeight: "100vh",
  };
  useLayoutEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = languageCode;
  }, [direction, languageCode]);

  useLayoutEffect(() => {
    void i18nInstance.changeLanguage(language.code);
    dayjs.calendar(
      language.calendar === "gregorian" ? "gregory" : language.calendar,
    );
    dayjs.locale(language.code === "en" ? "en-gb" : language.code);
  }, [language.calendar, language.code]);

  return (
    <ConfigProvider
      direction={direction}
      form={{ scrollToFirstError: { focus: true } }}
      locale={languageCode === "fa" ? fa : en}
      theme={themeConfig}
    >
      <StoryAppearanceContext.Provider value={appearance}>
        <div dir={direction} lang={languageCode} style={frameStyle}>
          {children}
        </div>
      </StoryAppearanceContext.Provider>
    </ConfigProvider>
  );
};
