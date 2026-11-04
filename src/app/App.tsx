import type { FC } from "react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { useCore } from "@/app/hooks/useCore";
import { CoreProvider } from "@/app/providers/core/Core";
import { ErrorBoundary } from "@/shared/ui/error-boundary";

const BootstrapLoading = () => {
  const { t } = useTranslation();
  const label = t("loading");

  return (
    <output
      aria-label={label}
      style={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        justifyContent: "center",
      }}
    >
      {label}
    </output>
  );
};

const ThemedApplication = lazy(async () => {
  const [{ AntdProvider }, { SettingsFeedback }, { Routes }] =
    await Promise.all([
      import("@/app/providers/antd/Antd"),
      import("@/app/providers/core/SettingsFeedback"),
      import("./Routes"),
    ]);

  const ThemedApplicationContent: FC = () => {
    const { themePalettes } = useCore();

    return (
      <AntdProvider>
        <SettingsFeedback />
        {themePalettes ? <Routes /> : null}
      </AntdProvider>
    );
  };

  return { default: ThemedApplicationContent };
});

const ApplicationContent = () => {
  const { settingsError, themePalettes } = useCore();

  if (!themePalettes && !settingsError) return <BootstrapLoading />;

  return (
    <Suspense fallback={<BootstrapLoading />}>
      <ThemedApplication />
    </Suspense>
  );
};

export const App = () => (
  <ErrorBoundary>
    <CoreProvider>
      <ApplicationContent />
    </CoreProvider>
  </ErrorBoundary>
);
