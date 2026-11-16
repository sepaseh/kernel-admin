import { Button, Result } from "antd";
import { useTranslation } from "react-i18next";

export const ErrorFallback = () => {
  const { t } = useTranslation();

  return (
    <Result
      extra={
        <Button onClick={() => window.location.reload()} type="primary">
          {t("reload")}
        </Button>
      }
      status="500"
      subTitle={t("unexpectedError")}
      title="500"
    />
  );
};
