import { Button, Card, Col, Flex, Form, Input, Row } from "antd";
import { useAntdToken } from "antd-style";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd, useCore } from "@/app/hooks";
import type { ChangePasswordParams } from "@/features/auth";
import { changePassword } from "@/features/auth";
import { clearAccessToken, getAccessTokenVersion } from "@/shared/api";
import { profileNameMaxLength } from "@/shared/contracts";
import { isCurrentMutationError, useMutationRequest } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { OtpInput } from "@/shared/ui/otp-input";
import { RequestFeedback } from "@/shared/ui/request-feedback";

import {
  getAccount,
  requestEmailVerification,
  updateProfile,
  updateUsername,
  verifyEmail,
} from "./api";
import type {
  Account,
  UpdateProfileRequest,
  UpdateUsernameRequest,
  VerifyEmailRequest,
} from "./types";

type ProfileFormParams = UpdateProfileRequest & Pick<Account, "mobile">;

type PasswordFormParams = ChangePasswordParams & {
  confirmPassword: string;
};

export const AccountPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [otpRemainingSeconds, setOtpRemainingSeconds] = useState(0);
  const [accountError, setAccountError] = useState<unknown>();
  const { messageAPI } = useAntd();
  const { setUser, user } = useCore();
  const latestUser = useRef(user);
  const [emailForm] = Form.useForm<VerifyEmailRequest>();
  const [passwordForm] = Form.useForm<PasswordFormParams>();
  const [profileForm] = Form.useForm<ProfileFormParams>();
  const [usernameForm] = Form.useForm<UpdateUsernameRequest>();
  const token = useAntdToken();
  const enabled = Boolean(user);
  const version = getAccessTokenVersion();
  const profileMutation = useMutationRequest(user?.id, enabled);
  const usernameMutation = useMutationRequest(user?.id, enabled);
  const emailMutation = useMutationRequest(user?.id, enabled);
  const otpMutation = useMutationRequest(user?.id, enabled);
  const passwordMutation = useMutationRequest(user?.id, enabled);
  const refreshMutation = useMutationRequest(user?.id, enabled);

  const acceptFields = (fields: Partial<Account>) => {
    const current = latestUser.current;
    if (!current) return;
    const updated = { ...current, ...fields };
    latestUser.current = updated;
    setUser(updated);
  };

  const refreshAccount = async () => {
    try {
      const result = await refreshMutation.run((signal) => getAccount(signal));
      if (!result?.isCurrent()) return;
      acceptFields(result.data);
      setAccountError(undefined);
    } catch (error) {
      if (isCurrentMutationError(error)) setAccountError(error.cause);
    }
  };

  const handleProfileSubmit = async ({
    firstName,
    lastName,
  }: ProfileFormParams): Promise<void> => {
    try {
      refreshMutation.cancel();
      const result = await profileMutation.run((signal) =>
        updateProfile({ firstName, lastName }, signal),
      );
      if (!result?.isCurrent()) return;
      refreshMutation.cancel();
      acceptFields({
        firstName: result.data.firstName,
        lastName: result.data.lastName,
      });
      void messageAPI.success(t("profileUpdated"));
    } catch (error) {
      if (isCurrentMutationError(error))
        void messageAPI.error(getErrorMessage(error.cause));
    }
  };

  const handleUsernameSubmit = async (
    values: UpdateUsernameRequest,
  ): Promise<void> => {
    try {
      refreshMutation.cancel();
      const result = await usernameMutation.run((signal) =>
        updateUsername(values, signal),
      );
      if (!result?.isCurrent()) return;
      refreshMutation.cancel();
      acceptFields({ username: result.data.username });
      void messageAPI.success(t("usernameUpdated"));
    } catch (error) {
      if (isCurrentMutationError(error))
        void messageAPI.error(getErrorMessage(error.cause));
    }
  };

  const requestEmailCode = async () => {
    if (otpRemainingSeconds) return;
    try {
      const result = await otpMutation.run(async (signal) => {
        const values = await emailForm
          .validateFields(["email"])
          .catch(() => undefined);
        if (
          !values ||
          signal.aborted ||
          values.email !== emailForm.getFieldValue("email")
        )
          return undefined;
        const response = await requestEmailVerification(
          { email: values.email },
          signal,
        );
        return {
          email: values.email,
          remainingSeconds: response.remainingSeconds,
        };
      });
      if (
        !result?.isCurrent() ||
        !result.data ||
        result.data.email !== emailForm.getFieldValue("email")
      )
        return;
      setOtpRemainingSeconds(result.data.remainingSeconds);
      void messageAPI.success(t("codeRequested"));
    } catch (error) {
      if (isCurrentMutationError(error))
        void messageAPI.error(getErrorMessage(error.cause));
    }
  };

  const handleEmailValuesChange = (changed: Partial<VerifyEmailRequest>) => {
    if (Object.hasOwn(changed, "email")) {
      otpMutation.cancel();
      emailMutation.cancel();
      refreshMutation.cancel();
      setOtpRemainingSeconds(0);
      emailForm.setFieldValue("otp", "");
    } else if (Object.hasOwn(changed, "otp")) {
      emailMutation.cancel();
    }
  };

  const handleEmailSubmit = async (
    values: VerifyEmailRequest,
  ): Promise<void> => {
    if (
      values.email !== emailForm.getFieldValue("email") ||
      values.otp !== emailForm.getFieldValue("otp")
    )
      return;
    let refreshing = false;
    try {
      const result = await emailMutation.run(async (signal) => {
        await verifyEmail(values, signal);
        if (signal.aborted || version !== getAccessTokenVersion())
          return undefined;
        refreshing = true;
        return getAccount(signal);
      });
      if (!result?.isCurrent() || !result.data) return;
      refreshMutation.cancel();
      acceptFields({ email: result.data.email });
      setAccountError(undefined);
      emailForm.setFieldValue("otp", "");
      void messageAPI.success(t("emailVerified"));
    } catch (error) {
      if (isCurrentMutationError(error)) {
        if (refreshing) setAccountError(error.cause);
        void messageAPI.error(getErrorMessage(error.cause));
      }
    }
  };

  const handlePasswordSubmit = async ({
    currentPassword,
    newPassword,
  }: PasswordFormParams): Promise<void> => {
    try {
      const result = await passwordMutation.run((signal) =>
        changePassword({ currentPassword, newPassword }, signal),
      );
      if (!result?.isCurrent()) return;
      void messageAPI.success(t("passwordChanged"));
      passwordForm.resetFields();
      clearAccessToken();
      latestUser.current = undefined;
      setUser();
      void navigate(routeTree.auth.path, { replace: true });
    } catch (error) {
      if (isCurrentMutationError(error))
        void messageAPI.error(getErrorMessage(error.cause));
    }
  };

  useLayoutEffect(() => {
    latestUser.current = user;
  }, [user]);

  useEffect(() => {
    setAccountError(undefined);
    setOtpRemainingSeconds(0);
    emailForm.resetFields();
    passwordForm.resetFields();
    profileForm.resetFields();
    usernameForm.resetFields();
  }, [emailForm, passwordForm, profileForm, usernameForm, user?.id, version]);

  useEffect(() => {
    if (!otpRemainingSeconds) return;
    const timeout = window.setTimeout(
      () => setOtpRemainingSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timeout);
  }, [otpRemainingSeconds]);

  if (!user) return null;

  return (
    <Row>
      <Col xs={24} lg={12} xl={8} xxl={6}>
        <RequestFeedback
          error={accountError}
          loading={refreshMutation.submitting}
          retry={refreshAccount}
        />
        <Flex gap={token.marginMD} vertical>
          <Card title={t("basicInfo")} variant="borderless">
            <Form<ProfileFormParams>
              form={profileForm}
              initialValues={{
                firstName: user.firstName,
                lastName: user.lastName,
                mobile: user.mobile,
              }}
              layout="vertical"
              onFinish={(values) => void handleProfileSubmit(values)}
            >
              <Form.Item
                label={t("firstName")}
                name="firstName"
                rules={[{ required: true, max: profileNameMaxLength }]}
              >
                <Input maxLength={profileNameMaxLength} />
              </Form.Item>
              <Form.Item
                label={t("lastName")}
                name="lastName"
                rules={[{ required: true, max: profileNameMaxLength }]}
              >
                <Input maxLength={profileNameMaxLength} />
              </Form.Item>
              <Form.Item
                label={t("mobile")}
                name="mobile"
                rules={[{ required: true }]}
              >
                <Input disabled style={{ direction: "ltr" }} />
              </Form.Item>
              <Flex justify="flex-end">
                <Button
                  htmlType="submit"
                  loading={profileMutation.submitting}
                  type="primary"
                >
                  {t("saveProfile")}
                </Button>
              </Flex>
            </Form>
          </Card>
          <Card title={t("username")} variant="borderless">
            <Form<UpdateUsernameRequest>
              form={usernameForm}
              initialValues={{ username: user.username ?? undefined }}
              layout="vertical"
              onFinish={(values) => void handleUsernameSubmit(values)}
            >
              <Form.Item
                label={t("username")}
                name="username"
                rules={[{ required: true }]}
              >
                <Input style={{ direction: "ltr" }} />
              </Form.Item>
              <Flex justify="flex-end">
                <Button
                  htmlType="submit"
                  loading={usernameMutation.submitting}
                  type="primary"
                >
                  {t("saveUsername")}
                </Button>
              </Flex>
            </Form>
          </Card>
          <Card title={t("email")} variant="borderless">
            <Form<VerifyEmailRequest>
              form={emailForm}
              initialValues={{ email: user.email ?? undefined }}
              layout="vertical"
              onFinish={(values) => void handleEmailSubmit(values)}
              onValuesChange={handleEmailValuesChange}
            >
              <Form.Item
                label={t("email")}
                name="email"
                rules={[{ required: true, type: "email" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label={t("otp")} required>
                <Flex gap={token.marginXS}>
                  <Form.Item name="otp" noStyle rules={[{ required: true }]}>
                    <OtpInput
                      aria-label={t("otp")}
                      length={6}
                      style={{ direction: "ltr" }}
                    />
                  </Form.Item>
                  <Button
                    disabled={Boolean(otpRemainingSeconds)}
                    htmlType="button"
                    loading={otpMutation.submitting}
                    onClick={() => void requestEmailCode()}
                  >
                    {otpRemainingSeconds || t("sendCode")}
                  </Button>
                </Flex>
              </Form.Item>
              <Flex justify="flex-end">
                <Button
                  htmlType="submit"
                  loading={emailMutation.submitting}
                  type="primary"
                >
                  {t("verifyEmail")}
                </Button>
              </Flex>
            </Form>
          </Card>
          <Card title={t("changePassword")} variant="borderless">
            <Form<PasswordFormParams>
              form={passwordForm}
              layout="vertical"
              onFinish={(values) => void handlePasswordSubmit(values)}
            >
              <Form.Item
                label={t("currentPassword")}
                name="currentPassword"
                rules={[{ required: true }]}
              >
                <Input.Password styles={{ input: { direction: "ltr" } }} />
              </Form.Item>
              <Form.Item
                label={t("newPassword")}
                name="newPassword"
                rules={[{ required: true }]}
              >
                <Input.Password styles={{ input: { direction: "ltr" } }} />
              </Form.Item>
              <Form.Item
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
                <Button
                  htmlType="submit"
                  loading={passwordMutation.submitting}
                  type="primary"
                >
                  {t("changePassword")}
                </Button>
              </Flex>
            </Form>
          </Card>
        </Flex>
      </Col>
    </Row>
  );
};
