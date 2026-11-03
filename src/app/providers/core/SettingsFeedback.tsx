import { useCore } from "@/app/hooks";
import { RequestFeedback } from "@/shared/ui/request-feedback";

export const SettingsFeedback = () => {
  const { retrySettings, settingsError, settingsLoading, themePalettes } =
    useCore();
  return (
    <RequestFeedback
      error={settingsError}
      hasData={!!themePalettes}
      loading={settingsLoading}
      retry={retrySettings}
    />
  );
};
