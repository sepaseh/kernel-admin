import { Alert, Button } from "antd";
import { useTranslation } from "react-i18next";

import { getErrorMessage } from "../../lib/error.ts";

type RequestFeedbackProps = {
  error?: unknown;
  hasData?: boolean;
  loading?: boolean;
  retry: () => unknown;
};

export const RequestFeedback = ({
  error,
  hasData = false,
  loading = false,
  retry,
}: RequestFeedbackProps) => {
  const { t } = useTranslation();
  const handleRetry = async () => {
    try {
      await retry();
    } catch {
      // Keep the existing failure feedback and retry action available.
    }
  };
  if (!error) return null;
  return (
    <Alert
      action={
        <Button loading={loading} onClick={() => void handleRetry()}>
          {t("retry")}
        </Button>
      }
      description={getErrorMessage(error)}
      showIcon
      style={{ marginBottom: 16 }}
      title={t(hasData ? "requestRefreshFailed" : "requestLoadFailed")}
      type={hasData ? "warning" : "error"}
    />
  );
};
