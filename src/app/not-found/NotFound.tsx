import { Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { routeTree } from "@/app/config";

export const NotFoundPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle={t("notFoundDescription")}
      extra={
        <Button
          onClick={() => void navigate(routeTree.root.path)}
          type="primary"
        >
          {t("backHome")}
        </Button>
      }
    />
  );
};
