import {
  Button,
  Drawer,
  Form,
  type FormProps,
  Input,
  Select,
  Space,
} from "antd";
import { isCancel } from "axios";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { getSessionSignal } from "@/shared/api";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock } from "@/shared/hooks";
import { generatePassword } from "@/shared/lib";
import { DigitsInput } from "@/shared/ui/digits-input";

import { createUser, fetchUser, updateUser } from "../../api";
import { userStatuses } from "../../constants";
import type { User, UserRequest } from "../../types";

type UserFormProps = {
  id?: User["id"];
  onClose: () => void;
  onFinish: () => void;
};

const initialFocusField = "firstName" satisfies keyof UserRequest;

export const UserForm = ({ id, onClose, onFinish }: UserFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<UserRequest>();
  const [loadedId, setLoadedId] = useState<User["id"]>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI, notificationAPI } = useAntd();
  const { hash } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canCreate, canUpdate } = getRoutePermissions("users", currentUser);
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);

  const handleClose = () => {
    cancel();
    onClose();
  };

  const handleSubmit: FormProps<UserRequest>["onFinish"] = async (values) => {
    if (
      !open ||
      loading ||
      submitting ||
      (isUpdate && loadedId !== id) ||
      !lock()
    )
      return;

    const sessionSignal = getSessionSignal();
    const signal = start();
    setSubmitting(true);

    try {
      if (isUpdate) {
        if (id === undefined) return;

        await updateUser(id, values, signal);
        if (signal.aborted || sessionSignal.aborted) return;

        void messageAPI.success(t("userUpdated"));
      } else {
        const password = generatePassword();
        await createUser({ ...values, password }, signal);
        if (sessionSignal.aborted) return;

        notificationAPI.success({
          description: password,
          title: t("userCreated"),
        });

        try {
          await navigator.clipboard?.writeText(password);
        } catch {
          // The generated password remains available in the notification.
        }
        if (signal.aborted || sessionSignal.aborted) return;
      }

      onFinish();
    } catch (error) {
      if (signal.aborted || sessionSignal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) {
        unlock();
        setSubmitting(false);
      }
    }
  };

  useLayoutEffect(
    () => cancel,
    [cancel, id, isCreate, isUpdate, onClose, open],
  );

  useEffect(() => {
    void (async () => {
      setLoadedId(undefined);
      setLoading(false);
      setSubmitting(false);
      unlock();

      if (!open) {
        if (isCreate || isUpdate) onClose();

        return;
      }

      if (!isUpdate) return;

      if (id === undefined) {
        onClose();
        return;
      }

      const signal = start();
      setLoading(true);

      try {
        const data = await fetchUser(id, signal);
        if (signal.aborted) return;

        form.setFieldsValue({
          firstName: data.firstName,
          lastName: data.lastName,
          mobile: data.mobile,
          status: data.status,
        });
        setLoadedId(data.id);
      } catch (error) {
        if (signal.aborted) return;

        if (error instanceof Error) void messageAPI.error(error.message);
        onClose();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();

    return cancel;
  }, [
    cancel,
    form,
    id,
    isCreate,
    isUpdate,
    messageAPI,
    onClose,
    open,
    start,
    unlock,
  ]);

  useEffect(() => {
    if (open && isUpdate && !loading && id !== undefined && loadedId === id)
      form.focusField(initialFocusField);
  }, [form, id, isUpdate, loadedId, loading, open]);

  return (
    <Drawer
      afterOpenChange={(open) => {
        if (!open) {
          form.resetFields();
          return;
        }

        if (
          isCreate ||
          (isUpdate && !loading && id !== undefined && loadedId === id)
        )
          form.focusField(initialFocusField);
      }}
      closeIcon={false}
      footer={
        <Space>
          <Button loading={submitting} onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={loading || submitting || (isUpdate && loadedId !== id)}
            loading={submitting}
            onClick={() => form.submit()}
            type="primary"
          >
            {t("submit")}
          </Button>
        </Space>
      }
      loading={loading}
      mask={{ closable: false }}
      onClose={handleClose}
      open={open}
      styles={{ footer: { textAlign: "end" } }}
      title={t(isUpdate ? "update" : "create")}
    >
      <Form<UserRequest>
        disabled={loading || submitting}
        form={form}
        initialValues={{ status: "active" }}
        layout="vertical"
        name="user-form"
        onFinish={handleSubmit}
      >
        <Form.Item<UserRequest>
          label={t("firstName")}
          name="firstName"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<UserRequest>
          label={t("lastName")}
          name="lastName"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<UserRequest>
          label={t("mobile")}
          name="mobile"
          rules={[{ required: true }]}
        >
          <DigitsInput />
        </Form.Item>
        <Form.Item<UserRequest>
          label={t("status")}
          name="status"
          rules={[{ required: true }]}
        >
          <Select
            options={userStatuses.map((value) => ({ label: t(value), value }))}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
