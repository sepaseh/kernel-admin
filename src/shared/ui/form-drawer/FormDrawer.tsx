import { Button, Drawer, type DrawerProps, Space } from "antd";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

import { trapDialogFocus } from "@/shared/lib/dialog-focus";

type FormDrawerProps = Omit<DrawerProps, "onClose"> & {
  onClose: NonNullable<DrawerProps["onClose"]>;
  onSubmit: () => void;
  submitting: boolean;
};

export const FormDrawer: FC<FormDrawerProps> = ({
  children,
  onClose,
  onKeyDown,
  onSubmit,
  submitting,
  ...rest
}) => {
  const { t } = useTranslation();

  return (
    <Drawer
      closeIcon={false}
      footer={
        <Space>
          <Button loading={submitting} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={submitting} onClick={onSubmit} type="primary">
            {t("submit")}
          </Button>
        </Space>
      }
      mask={{ closable: false }}
      onClose={onClose}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        trapDialogFocus(event);
      }}
      styles={{ footer: { textAlign: "end" } }}
      {...rest}
    >
      {children}
    </Drawer>
  );
};
