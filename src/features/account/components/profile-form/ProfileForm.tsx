import { Button, Card, Flex, Form, type FormProps, Input } from "antd";
import { isCancel } from "axios";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import type { DefaultLayoutContext } from "@/layouts/default";
import { getAccessTokenVersion } from "@/shared/api";
import { profileNameMaxLength } from "@/shared/contracts";
import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";

import { updateProfile } from "../../api";
import type { ProfileRequest } from "../../types";

export const ProfileForm = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ProfileRequest>();
  const [loading, setLoading] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { lock, unlock } = useLock();
  const { fetchCurrentUser, currentUser } =
    useOutletContext<DefaultLayoutContext>();
  const version = getAccessTokenVersion();

  const handleSubmit: FormProps<ProfileRequest>["onFinish"] = async (
    values,
  ) => {
    if (version !== getAccessTokenVersion() || !lock()) return;

    const signal = start();
    setLoading(true);

    try {
      await updateProfile(values, signal);
      if (signal.aborted || version !== getAccessTokenVersion()) return;

      // The layout owns refresh feedback after the profile has been saved.
      await fetchCurrentUser().catch(() => undefined);
      if (signal.aborted || version !== getAccessTokenVersion()) return;

      void messageAPI.success(t("profileUpdated"));
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
    <Card title={t("basicInfo")} variant="borderless">
      <Form<ProfileRequest>
        disabled={loading}
        form={form}
        initialValues={{
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
        }}
        layout="vertical"
        name="profile-form"
        onFinish={handleSubmit}
      >
        <Form.Item<ProfileRequest>
          label={t("firstName")}
          name="firstName"
          rules={[{ required: true, max: profileNameMaxLength }]}
        >
          <Input autoFocus maxLength={profileNameMaxLength} />
        </Form.Item>
        <Form.Item<ProfileRequest>
          label={t("lastName")}
          name="lastName"
          rules={[{ required: true, max: profileNameMaxLength }]}
        >
          <Input maxLength={profileNameMaxLength} />
        </Form.Item>
        <Flex justify="flex-end">
          <Button htmlType="submit" loading={loading} type="primary">
            {t("saveProfile")}
          </Button>
        </Flex>
      </Form>
    </Card>
  );
};
