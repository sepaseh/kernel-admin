import type { ConfigProviderProps } from "antd";
import { App as AntdApp, ConfigProvider } from "antd";
import ar from "antd/locale/ar_EG";
import de from "antd/locale/de_DE";
import en from "antd/locale/en_GB";
import es from "antd/locale/es_ES";
import fa from "antd/locale/fa_IR";
import fr from "antd/locale/fr_FR";
import it from "antd/locale/it_IT";
import pt from "antd/locale/pt_PT";
import ru from "antd/locale/ru_RU";
import tr from "antd/locale/tr_TR";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { useCore } from "@/app/hooks";
import type { Language } from "@/shared/config";
import { createThemeConfig } from "@/shared/config";

type AntdProviderProps = {
  children?: ReactNode;
};

const antdLocales = {
  ar,
  de,
  en,
  es,
  fa,
  fr,
  it,
  pt,
  ru,
  tr,
} satisfies Record<Language, ConfigProviderProps["locale"]>;

export const AntdProvider = ({ children }: AntdProviderProps) => {
  const { compact, language, theme: currentTheme, themePalettes } = useCore();
  const themeConfig = createThemeConfig(
    currentTheme,
    compact,
    themePalettes?.[currentTheme],
  );
  const { token } = themeConfig;
  const { code, direction } = language;
  const locale = antdLocales[code];

  useEffect(() => {
    document.body.style.backgroundColor = token?.colorBgBase ?? "";
    document.body.style.color = token?.colorTextBase ?? "";
    document.body.style.setProperty(
      "--admin-focus-color",
      token?.colorTextBase ?? "CanvasText",
    );
  }, [token]);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = code;
  }, [code, direction]);

  return (
    <ConfigProvider
      direction={direction}
      form={{ scrollToFirstError: { focus: true } }}
      locale={locale}
      theme={themeConfig}
    >
      <AntdApp component={false}>{children}</AntdApp>
    </ConfigProvider>
  );
};
