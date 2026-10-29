import { useCore } from "@/app/hooks";
import { AntdProvider, CoreProvider } from "@/app/providers";
import { SettingsFeedback } from "@/app/providers/core/SettingsFeedback";
import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { RouteLoading } from "@/shared/ui/route-loading";

import { Routes } from "./Routes";

const ApplicationContent = () => {
  const { settingsError, themePalettes } = useCore();

  if (!themePalettes)
    return settingsError ? <SettingsFeedback /> : <RouteLoading />;

  return (
    <>
      <SettingsFeedback />
      <Routes />
    </>
  );
};

export const App = () => (
  <ErrorBoundary>
    <CoreProvider>
      <AntdProvider>
        <ApplicationContent />
      </AntdProvider>
    </CoreProvider>
  </ErrorBoundary>
);
