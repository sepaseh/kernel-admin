import { Button, Flex, Form, type FormProps, Input, Typography } from "antd";
import { isCancel } from "axios";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd, useCore } from "@/app/hooks";
import { login, type LoginParams } from "@/features/auth";
import { useAbortController, useLock } from "@/shared/hooks";
import { DigitsInput } from "@/shared/ui/digits-input";

export const LoginPage = () => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { settings, theme } = useCore();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const logo = settings[`${theme}Logo`]?.url;

  const handleSubmit: FormProps<LoginParams>["onFinish"] = async (values) => {
    if (!lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      await login(values, signal);
      if (signal.aborted) return;

      void navigate(routeTree.root.path, { replace: true });
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) {
        unlock();
        setSubmitting(false);
      }
    }
  };

  useLayoutEffect(() => cancel, [cancel]);

  return (
    <Flex gap={32} vertical>
      <Flex align="center" gap={8} vertical>
        {logo ? (
          <img
            alt={t("logo")}
            src={logo}
            style={{ display: "block", height: 40, width: "auto" }}
          />
        ) : null}
        <Typography.Title level={1} style={{ fontSize: 16 }}>
          {t("login")}
        </Typography.Title>
      </Flex>
      <Form<LoginParams>
        disabled={submitting}
        layout="vertical"
        name="login-form"
        onFinish={handleSubmit}
        requiredMark={false}
        scrollToFirstError={{ focus: true }}
      >
        <Form.Item<LoginParams>
          label={t("mobile")}
          name="mobile"
          rules={[{ required: true }]}
        >
          <DigitsInput
            autoComplete="username"
            placeholder={t("mobile")}
            size="large"
            style={{ direction: "ltr" }}
          />
        </Form.Item>
        <Form.Item<LoginParams>
          label={t("password")}
          name="password"
          rules={[{ required: true }]}
        >
          <Input.Password
            autoComplete="current-password"
            placeholder={t("password")}
            size="large"
            styles={{ input: { direction: "ltr" } }}
          />
        </Form.Item>
        <Flex justify="space-between">
          <Link to={routeTree.register.path}>{t("register")}</Link>
          <Link to={routeTree.forgotPassword.path}>{t("forgotPassword")}</Link>
        </Flex>
        <Button
          block
          htmlType="submit"
          loading={submitting}
          size="large"
          style={{ marginTop: 32 }}
          type="primary"
        >
          {t("login")}
        </Button>
      </Form>
    </Flex>
  );
};
