import { Button, Result } from "antd";
import { useTranslation } from "react-i18next";

type ErrorFallbackProps = {
  onRetry?: () => void | Promise<void>;
  title?: string;
};

const reloadPage = () => window.location.reload();

export const ErrorFallback = ({
  onRetry,
  title = "500",
}: ErrorFallbackProps) => {
  const { t } = useTranslation();
  const recover = onRetry ?? reloadPage;

  return (
    <Result
      extra={
        <Button onClick={() => void recover()} type="primary">
          {t(onRetry ? "retry" : "reload")}
        </Button>
      }
      status="500"
      subTitle={t("unexpectedError")}
      title={onRetry ? <span role="alert">{title}</span> : title}
    />
  );
};
