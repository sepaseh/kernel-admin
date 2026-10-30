import { useCore } from "@/app/hooks";
import { AntdProvider, CoreProvider } from "@/app/providers";
import { SettingsFeedback } from "@/app/providers/core/SettingsFeedback";
import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { RouteLoading } from "@/shared/ui/route-loading";

import { Routes } from "./Routes";

const ApplicationContent = () => {
  const { settingsError, themePalettes } = useCore();

  if (!themePalettes && !settingsError) return <RouteLoading />;

  return (
    <AntdProvider>
      <SettingsFeedback />
      {themePalettes ? <Routes /> : null}
    </AntdProvider>
  );
};

export const App = () => (
  <ErrorBoundary>
    <CoreProvider>
      <ApplicationContent />
    </CoreProvider>
  </ErrorBoundary>
);
