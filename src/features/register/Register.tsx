import { Button, Flex, Form, type FormProps, Input, Typography } from "antd";
import { isCancel } from "axios";
import { UserRound } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd } from "@/app/hooks";
import { register, type RegisterParams, useOtpRequest } from "@/features/auth";
import { useAbortController, useLock } from "@/shared/hooks";
import { DigitsInput } from "@/shared/ui/digits-input";
import { OtpInput } from "@/shared/ui/otp-input";
import { PasswordFields } from "@/shared/ui/password-fields";

type RegisterFormParams = RegisterParams & {
  confirmPassword: string;
};

export const RegisterPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<RegisterFormParams>();
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { lock, unlock } = useLock();
  const {
    handleOtpRequest,
    handleValuesChange,
    remainingSeconds,
    requestingOtp,
  } = useOtpRequest({
    form,
    onError: (error) => {
      void messageAPI.error(
        error instanceof Error ? error.message : t("unexpectedError"),
      );
    },
    onSuccess: () => {
      void messageAPI.success(t("codeRequested"));
    },
    purpose: "register",
  });

  const navigate = useNavigate();

  const handleSubmit: FormProps<RegisterFormParams>["onFinish"] = async ({
    firstName,
    lastName,
    mobile,
    otp,
    password,
  }) => {
    if (!lock()) return;

    const signal = start();
    setSubmitting(true);
    try {
      await register({ firstName, lastName, mobile, otp, password }, signal);
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
        <UserRound aria-hidden color="currentColor" size={28} />
        <Typography.Title level={1} style={{ fontSize: 16 }}>
          {t("register")}
        </Typography.Title>
      </Flex>
      <Form<RegisterFormParams>
        disabled={submitting}
        form={form}
        layout="vertical"
        name="register-form"
        onFinish={handleSubmit}
        onValuesChange={handleValuesChange}
        requiredMark={false}
        scrollToFirstError={{ focus: true }}
      >
        <Flex gap={8}>
          <Form.Item<RegisterFormParams>
            label={t("firstName")}
            name="firstName"
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <Input placeholder={t("firstName")} size="large" />
          </Form.Item>
          <Form.Item<RegisterFormParams>
            label={t("lastName")}
            name="lastName"
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <Input placeholder={t("lastName")} size="large" />
          </Form.Item>
        </Flex>
        <Form.Item<RegisterFormParams>
          label={t("mobile")}
          name="mobile"
          rules={[{ required: true }]}
        >
          <DigitsInput
            placeholder={t("mobile")}
            size="large"
            style={{ direction: "ltr" }}
          />
        </Form.Item>
        <Form.Item label={t("otp")} required>
          <Flex gap={8}>
            <Form.Item<RegisterFormParams>
              name="otp"
              noStyle
              rules={[{ required: true }]}
            >
              <OtpInput
                aria-label={t("otp")}
                length={6}
                role="group"
                size="large"
                style={{ direction: "ltr" }}
              />
            </Form.Item>
            <Button
              disabled={Boolean(remainingSeconds)}
              htmlType="button"
              loading={requestingOtp}
              onClick={handleOtpRequest}
              size="large"
            >
              {remainingSeconds || t("sendCode")}
            </Button>
          </Flex>
        </Form.Item>
        <PasswordFields size="large" />
        <Button
          block
          htmlType="submit"
          loading={submitting}
          size="large"
          style={{ marginTop: 32 }}
          type="primary"
        >
          {t("register")}
        </Button>
      </Form>
      <Flex justify="center">
        <Link to={routeTree.auth.path}>{t("backToLogin")}</Link>
      </Flex>
    </Flex>
  );
};
