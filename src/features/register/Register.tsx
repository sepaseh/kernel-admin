import type { FormProps } from "antd";
import { Button, Flex, Form, Input, Typography } from "antd";
import { isCancel } from "axios";
import { UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd } from "@/app/hooks";
import { register, requestOtp } from "@/features/auth/api.ts";
import type { RegisterParams } from "@/features/auth/types.ts";
import { profileNameMaxLength } from "@/shared/contracts";
import { getErrorMessage } from "@/shared/lib";
import { DigitsInput } from "@/shared/ui/digits-input";
import { OtpInput } from "@/shared/ui/otp-input";
import { PasswordFields } from "@/shared/ui/password-fields";

type RegisterFormParams = RegisterParams & {
  confirmPassword: string;
};

export const RegisterPage = () => {
  const { t } = useTranslation();
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const otpRequest = useRef<AbortController | undefined>(undefined);
  const submission = useRef<AbortController | undefined>(undefined);
  const { messageAPI } = useAntd();
  const [form] = Form.useForm<RegisterFormParams>();
  const navigate = useNavigate();

  const handleOtpRequest = async () => {
    if (otpRequest.current || remainingSeconds) return;

    const controller = new AbortController();
    otpRequest.current = controller;
    setRequestingOtp(true);
    try {
      const values = await form
        .validateFields(["mobile"])
        .catch(() => undefined);
      if (!values || controller.signal.aborted) return;
      const { mobile } = values;
      const response = await requestOtp(
        { mobile, purpose: "register" },
        controller.signal,
      );
      if (controller.signal.aborted || form.getFieldValue("mobile") !== mobile)
        return;
      setRemainingSeconds(response.remainingSeconds);
      void messageAPI.success(t("codeRequested"));
    } catch (error) {
      if (!controller.signal.aborted && !isCancel(error))
        void messageAPI.error(getErrorMessage(error));
    } finally {
      if (otpRequest.current === controller) {
        otpRequest.current = undefined;
        if (!controller.signal.aborted) setRequestingOtp(false);
      }
    }
  };

  const handleSubmit: FormProps<RegisterFormParams>["onFinish"] = async ({
    firstName,
    lastName,
    mobile,
    otp,
    password,
  }) => {
    if (submission.current) return;

    const controller = new AbortController();
    submission.current = controller;
    setSubmitting(true);
    try {
      await register(
        { firstName, lastName, mobile, otp, password },
        controller.signal,
      );
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

  const handleValuesChange = (changed: Partial<RegisterFormParams>) => {
    if (!Object.hasOwn(changed, "mobile")) return;
    otpRequest.current?.abort();
    otpRequest.current = undefined;
    setRequestingOtp(false);
    setRemainingSeconds(0);
    form.setFieldValue("otp", "");
  };

  useEffect(
    () => () => {
      otpRequest.current?.abort();
      submission.current?.abort();
      otpRequest.current = undefined;
      submission.current = undefined;
    },
    [],
  );

  useEffect(() => {
    if (!remainingSeconds) return;

    const timeout = window.setTimeout(
      () => setRemainingSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );

    return () => window.clearTimeout(timeout);
  }, [remainingSeconds]);

  return (
    <Flex gap={32} vertical>
      <Flex align="center" gap={8} vertical>
        <UserRound aria-hidden color="currentColor" size={28} />
        <Typography.Title level={1} style={{ fontSize: 16 }}>
          {t("register")}
        </Typography.Title>
      </Flex>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={handleValuesChange}
        requiredMark={false}
        scrollToFirstError={{ focus: true }}
      >
        <Flex gap={8}>
          <Form.Item<RegisterFormParams>
            label={t("firstName")}
            name="firstName"
            rules={[{ required: true, max: profileNameMaxLength }]}
            style={{ flex: 1 }}
          >
            <Input
              maxLength={profileNameMaxLength}
              placeholder={t("firstName")}
              size="large"
            />
          </Form.Item>
          <Form.Item<RegisterFormParams>
            label={t("lastName")}
            name="lastName"
            rules={[{ required: true, max: profileNameMaxLength }]}
            style={{ flex: 1 }}
          >
            <Input
              maxLength={profileNameMaxLength}
              placeholder={t("lastName")}
              size="large"
            />
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
              loading={requestingOtp}
              onClick={handleOtpRequest}
              size="large"
            >
              {remainingSeconds || t("sendCode")}
            </Button>
          </Flex>
        </Form.Item>
        <PasswordFields size="large" />
      </Form>
      <Button
        block
        loading={submitting}
        onClick={() => form.submit()}
        size="large"
        type="primary"
      >
        {t("register")}
      </Button>
      <Flex justify="center">
        <Link to={routeTree.auth.path}>{t("backToLogin")}</Link>
      </Flex>
    </Flex>
  );
};
