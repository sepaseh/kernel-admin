import { Alert, Button } from "antd";
import { useTranslation } from "react-i18next";

type RequestErrorProps = {
  error: Error;
  onRetry: () => unknown;
};

export const RequestError = ({ error, onRetry }: RequestErrorProps) => {
  const { t } = useTranslation();

  return (
    <Alert
      action={<Button onClick={() => void onRetry()}>{t("retry")}</Button>}
      showIcon
      title={error.message || t("unexpectedError")}
      type="error"
    />
  );
};
