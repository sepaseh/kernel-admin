import type { FC } from "react";
import { lazy, Suspense } from "react";

import { useCore } from "@/app/hooks/useCore";
import { CoreProvider } from "@/app/providers/core/Core";
import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { RouteLoading } from "@/shared/ui/route-loading";

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

  if (!themePalettes && !settingsError) return <RouteLoading />;

  return (
    <Suspense fallback={<RouteLoading />}>
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
