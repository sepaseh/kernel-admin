import { Button, Card, Flex, Form, type FormProps, Input } from "antd";
import { isCancel } from "axios";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { changePassword, type ChangePasswordParams } from "@/features/auth";
import type { DefaultLayoutContext } from "@/layouts/default";
import { getAccessTokenVersion } from "@/shared/api";
import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";

type PasswordFormParams = ChangePasswordParams & {
  confirmPassword: string;
};

export const PasswordForm = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<PasswordFormParams>();
  const [loading, setLoading] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { lock, unlock } = useLock();
  const { clearSession, currentUser } =
    useOutletContext<DefaultLayoutContext>();
  const version = getAccessTokenVersion();

  const handleSubmit: FormProps<PasswordFormParams>["onFinish"] = async (
    values,
  ) => {
    if (version !== getAccessTokenVersion() || !lock()) return;

    const signal = start();
    setLoading(true);

    try {
      const { currentPassword, newPassword } = values;
      await changePassword({ currentPassword, newPassword }, signal);
      if (signal.aborted || version !== getAccessTokenVersion()) return;

      form.resetFields();
      void messageAPI.success(t("passwordChanged"));
      clearSession();
    } catch (error) {
      if (
        signal.aborted ||
        version !== getAccessTokenVersion() ||
        isCancel(error)
      )
        return;

      void messageAPI.error(getErrorMessage(error));
    } finally {
      if (!signal.aborted) {
        unlock();
        setLoading(false);
      }
    }
  };

  useLayoutEffect(() => {
    form.resetFields();
    unlock();
    setLoading(false);
    return cancel;
  }, [cancel, currentUser.id, form, unlock, version]);

  return (
    <Card title={t("changePassword")} variant="borderless">
      <Form<PasswordFormParams>
        disabled={loading}
        form={form}
        layout="vertical"
        name="password-form"
        onFinish={handleSubmit}
      >
        <Form.Item<PasswordFormParams>
          label={t("currentPassword")}
          name="currentPassword"
          rules={[{ required: true }]}
        >
          <Input.Password autoFocus styles={{ input: { direction: "ltr" } }} />
        </Form.Item>
        <Form.Item<PasswordFormParams>
          label={t("newPassword")}
          name="newPassword"
          rules={[{ required: true }]}
        >
          <Input.Password styles={{ input: { direction: "ltr" } }} />
        </Form.Item>
        <Form.Item<PasswordFormParams>
          dependencies={["newPassword"]}
          label={t("confirmPassword")}
          name="confirmPassword"
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error(t("passwordMismatch")));
              },
            }),
          ]}
        >
          <Input.Password styles={{ input: { direction: "ltr" } }} />
        </Form.Item>
        <Flex justify="flex-end">
          <Button htmlType="submit" loading={loading} type="primary">
            {t("changePassword")}
          </Button>
        </Flex>
      </Form>
    </Card>
  );
};
