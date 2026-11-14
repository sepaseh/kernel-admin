import { Button, Flex, Form, type FormProps, Typography } from "antd";
import { isCancel } from "axios";
import { LockKeyhole } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd } from "@/app/hooks";
import {
  forgotPassword,
  type ForgotPasswordParams,
  useOtpRequest,
} from "@/features/auth";
import { useAbortController, useLock } from "@/shared/hooks";
import { DigitsInput } from "@/shared/ui/digits-input";
import { OtpInput } from "@/shared/ui/otp-input";
import { PasswordFields } from "@/shared/ui/password-fields";

type ForgotPasswordFormParams = ForgotPasswordParams & {
  confirmPassword: string;
};

export const ForgotPassPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ForgotPasswordFormParams>();
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
    purpose: "forgot_password",
  });

  const navigate = useNavigate();

  const handleSubmit: FormProps<ForgotPasswordFormParams>["onFinish"] = async ({
    mobile,
    otp,
    password,
  }) => {
    if (!lock()) return;

    const signal = start();
    setSubmitting(true);
    try {
      await forgotPassword({ mobile, otp, password }, signal);
      if (signal.aborted) return;

      void messageAPI.success(t("passwordReset"));
      void navigate(routeTree.auth.path, { replace: true });
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
        <LockKeyhole aria-hidden color="currentColor" size={28} />
        <Typography.Title level={1} style={{ fontSize: 16 }}>
          {t("forgotPassword")}
        </Typography.Title>
      </Flex>
      <Form<ForgotPasswordFormParams>
        disabled={submitting}
        form={form}
        layout="vertical"
        name="forgot-password-form"
        onFinish={handleSubmit}
        onValuesChange={handleValuesChange}
        requiredMark={false}
        scrollToFirstError={{ focus: true }}
      >
        <Form.Item<ForgotPasswordFormParams>
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
            <Form.Item<ForgotPasswordFormParams>
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
        <PasswordFields passwordLabel="newPassword" size="large" />
        <Button
          block
          htmlType="submit"
          loading={submitting}
          size="large"
          style={{ marginTop: 32 }}
          type="primary"
        >
          {t("resetPassword")}
        </Button>
      </Form>
      <Flex justify="center">
        <Link to={routeTree.auth.path}>{t("backToLogin")}</Link>
      </Flex>
    </Flex>
  );
};
