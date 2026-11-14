import { Button, Drawer, type DrawerProps, Space } from "antd";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

type FormDrawerProps = PropsWithChildren<
  Omit<DrawerProps, "children" | "onClose"> & {
    onClose: NonNullable<DrawerProps["onClose"]>;
    onSubmit: () => void;
    submitDisabled?: boolean;
    submitting: boolean;
  }
>;

export const FormDrawer = ({
  children,
  onClose,
  onSubmit,
  submitDisabled,
  submitting,
  ...rest
}: FormDrawerProps) => {
  const { t } = useTranslation();

  return (
    <Drawer
      closeIcon={false}
      footer={
        <Space>
          <Button loading={submitting} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={submitDisabled}
            loading={submitting}
            onClick={onSubmit}
            type="primary"
          >
            {t("submit")}
          </Button>
        </Space>
      }
      mask={{ closable: false }}
      onClose={onClose}
      styles={{ footer: { textAlign: "end" } }}
      {...rest}
    >
      {children}
    </Drawer>
  );
};
