import { Button, Card, Flex, Form, type FormProps, Input } from "antd";
import { isCancel } from "axios";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import type { DefaultLayoutContext } from "@/layouts/default";
import { useAbortController, useLock } from "@/shared/hooks";

import { updateProfile } from "../../api";
import type { ProfileRequest } from "../../types";

const initialFocusField = "firstName" satisfies keyof ProfileRequest;

export const ProfileForm = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ProfileRequest>();
  const [loading, setLoading] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { lock, unlock } = useLock();
  const { fetchCurrentUser, currentUser } =
    useOutletContext<DefaultLayoutContext>();

  const handleSubmit: FormProps<ProfileRequest>["onFinish"] = async (
    values,
  ) => {
    if (!lock()) return;

    const signal = start();
    setLoading(true);

    try {
      await updateProfile(values, signal);
      if (signal.aborted) return;

      await fetchCurrentUser();
      if (signal.aborted) return;

      void messageAPI.success(t("profileUpdated"));
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) {
        unlock();
        setLoading(false);
      }
    }
  };

  useLayoutEffect(() => cancel, [cancel]);

  useEffect(() => {
    form.focusField(initialFocusField);
  }, [form]);

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
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<ProfileRequest>
          label={t("lastName")}
          name="lastName"
          rules={[{ required: true }]}
        >
          <Input />
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
