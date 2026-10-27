import { Button, Flex, Form, Typography } from "antd";
import { isCancel } from "axios";
import { LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd } from "@/app/hooks";
import { forgotPassword } from "@/features/auth/api.ts";
import type { ForgotPasswordParams } from "@/features/auth/types.ts";
import { useOtpRequest } from "@/features/auth/useOtpRequest.ts";
import { getErrorMessage } from "@/shared/lib";
import { DigitsInput } from "@/shared/ui/digits-input";
import { OtpInput } from "@/shared/ui/otp-input";
import { PasswordFields } from "@/shared/ui/password-fields";

type ForgotPasswordFormParams = ForgotPasswordParams & {
  confirmPassword: string;
};

export const ForgotPassPage = () => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef<AbortController | undefined>(undefined);
  const { messageAPI } = useAntd();
  const [form] = Form.useForm<ForgotPasswordFormParams>();
  const navigate = useNavigate();
  const {
    handleOtpRequest,
    handleValuesChange,
    remainingSeconds,
    requestingOtp,
  } = useOtpRequest({
    form,
    onError: (error) => {
      void messageAPI.error(getErrorMessage(error));
    },
    onSuccess: () => {
      void messageAPI.success(t("codeRequested"));
    },
    purpose: "forgot_password",
  });

  const handleSubmit = async ({
    mobile,
    otp,
    password,
  }: ForgotPasswordFormParams): Promise<void> => {
    if (submission.current) return;

    const controller = new AbortController();
    submission.current = controller;
    setSubmitting(true);
    try {
      await forgotPassword({ mobile, otp, password }, controller.signal);
      if (controller.signal.aborted) return;
      void messageAPI.success(t("passwordReset"));
      void navigate(routeTree.auth.path, { replace: true });
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
        <LockKeyhole aria-hidden color="currentColor" size={28} />
        <Typography.Title level={1} style={{ fontSize: 16 }}>
          {t("forgotPassword")}
        </Typography.Title>
      </Flex>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void handleSubmit(values)}
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
