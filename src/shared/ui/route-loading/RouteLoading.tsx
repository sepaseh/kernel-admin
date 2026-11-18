import { Flex, Spin } from "antd";
import { useTranslation } from "react-i18next";

export const RouteLoading = () => {
  const { t } = useTranslation();

  return (
    <Flex align="center" justify="center" style={{ minHeight: "40vh" }}>
      <Spin
        aria-label={t("loading")}
        ref={(node) => node?.nativeElement.setAttribute("role", "status")}
      />
    </Flex>
  );
};
