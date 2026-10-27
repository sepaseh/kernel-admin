import type { FormProps } from "antd";
import { Button, Flex, Form, Input, Typography } from "antd";
import { isCancel } from "axios";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd, useCore } from "@/app/hooks";
import { login } from "@/features/auth/api.ts";
import type { LoginParams } from "@/features/auth/types.ts";
import { getErrorMessage } from "@/shared/lib";

import { useLoginStyles } from "./styles";

export const LoginPage = () => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef<AbortController | undefined>(undefined);
  const { messageAPI } = useAntd();
  const { logos, theme } = useCore();
  const [form] = Form.useForm<LoginParams>();
  const navigate = useNavigate();
  const { styles } = useLoginStyles();

  const handleSubmit: FormProps<LoginParams>["onFinish"] = async (values) => {
    if (submission.current) return;

    const controller = new AbortController();
    submission.current = controller;
    setSubmitting(true);
    try {
      await login(values, controller.signal);
      if (controller.signal.aborted) return;
      void navigate(routeTree.root.path, { replace: true });
    } catch (error) {
      if (!controller.signal.aborted && !isCancel(error))
        void messageAPI.error(getErrorMessage(error));
    } finally {
      if (submission.current === controller) {
        submission.current = undefined;
        if (!controller.signal.aborted) setSubmitting(false);
      }
    }
  };

  const handleSubmitTrigger = () => {
    form.submit();
  };

  useEffect(
    () => () => {
      submission.current?.abort();
      submission.current = undefined;
    },
    [],
  );

  return (
    <Flex gap={32} vertical>
      <Flex align="center" gap={8} vertical>
        {logos?.[theme] ? (
          <img
            alt={t("logo")}
            src={logos[theme]}
            style={{ display: "block", height: 40, width: "auto" }}
          />
        ) : null}
        <Typography.Title level={1} style={{ fontSize: 16 }}>
          {t("login")}
        </Typography.Title>
      </Flex>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        scrollToFirstError={{ focus: true }}
      >
        <Form.Item<LoginParams>
          label={t("identifier")}
          name="identifier"
          rules={[{ required: true }]}
        >
          <Input
            className={styles.input}
            onPressEnter={handleSubmitTrigger}
            placeholder={t("identifier")}
            size="large"
          />
        </Form.Item>
        <Form.Item<LoginParams>
          label={t("password")}
          name="password"
          rules={[{ required: true }]}
        >
          <Input.Password
            classNames={{ input: styles.input }}
            onPressEnter={handleSubmitTrigger}
            placeholder={t("password")}
            size="large"
            type="password"
          />
        </Form.Item>
        <Flex justify="space-between">
          <Link to={routeTree.register.path}>{t("register")}</Link>
          <Link to={routeTree.forgotPassword.path}>{t("forgotPassword")}</Link>
        </Flex>
      </Form>
      <Button
        block
        loading={submitting}
        onClick={handleSubmitTrigger}
        size="large"
        type="primary"
      >
        {t("login")}
      </Button>
    </Flex>
  );
};
