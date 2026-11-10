import {
  type ConfigProviderProps,
  type ThemeConfig,
  App,
  ConfigProvider,
  theme,
} from "antd";
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
import { type PropsWithChildren, useEffect, useMemo } from "react";

import { useCore } from "@/app/hooks";
import type { Settings } from "@/features/settings";

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
} satisfies Record<Settings["language"]["code"], ConfigProviderProps["locale"]>;

export const AntdProvider = ({ children }: PropsWithChildren) => {
  const { compact, settings, theme: currentTheme } = useCore();
  const palette = settings[`${currentTheme}Theme`];
  const themeConfig = useMemo<ThemeConfig>(() => {
    const algorithm = [
      currentTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
      ...(compact ? [theme.compactAlgorithm] : []),
    ];
    const token = { ...palette, fontFamily: "inherit" };
    const designToken = theme.getDesignToken({ algorithm, token });

    return {
      algorithm,
      components: {
        Layout: {
          bodyBg: designToken.colorBgLayout,
          headerBg: designToken.colorBgContainer,
          headerPadding: 0,
        },
        Menu: { colorSplit: "transparent" },
      },
      token,
    };
  }, [currentTheme, compact, palette]);
  const { code, direction } = settings.language;
  const locale = antdLocales[code];

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
      <App component={false}>{children}</App>
    </ConfigProvider>
  );
};
