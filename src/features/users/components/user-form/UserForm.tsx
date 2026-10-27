import { Form, Input } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { createUser, updateUser } from "@/features/users/api";
import { userDrawerKeys } from "@/features/users/constants";
import { generatePassword } from "@/features/users/tools/password";
import type { User, UserRequest } from "@/features/users/types";
import { profileNameMaxLength } from "@/shared/contracts";
import {
  isCurrentMutationError,
  useGoBack,
  useMutationRequest,
} from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { DigitsInput } from "@/shared/ui/digits-input";
import { FormDrawer } from "@/shared/ui/form-drawer";

type UserFormProps = {
  data?: User;
  onFinish: () => void;
};

export const UserForm = ({ data, onFinish }: UserFormProps) => {
  const { t } = useTranslation();
  const { messageAPI, notificationAPI } = useAntd();
  const { user } = useCore();
  const { canCreate, canUpdate } = getRoutePermissions("users", user);
  const { hash, pathname, search } = useLocation();
  const [form] = Form.useForm<UserRequest>();
  const goBack = useGoBack();
  const isUpdate = hash === userDrawerKeys.update && !!data;
  const isCreate = hash === userDrawerKeys.create;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);
  const mutation = useMutationRequest(
    JSON.stringify([pathname, search, hash, data?.id, user?.id]),
    open,
  );

  const handleSubmit = async (values: UserRequest): Promise<void> => {
    if (!open) return;

    try {
      const result = await mutation.run(async (signal) => {
        if (isUpdate) {
          await updateUser(data.id, values, signal);
          return undefined;
        }
        const password = generatePassword();
        await createUser({ ...values, password }, signal);
        return password;
      });
      if (!result?.isCurrent()) return;
      const password = result.data;
      if (password) {
        void navigator.clipboard?.writeText(password).catch(() => undefined);
        notificationAPI.success({
          description: password,
          message: t("password"),
        });
      }
      messageAPI.success(t(isUpdate ? "userUpdated" : "userCreated"));
      goBack();
      onFinish();
    } catch (error) {
      if (isCurrentMutationError(error))
        messageAPI.error(getErrorMessage(error.cause));
    }
  };

  useEffect(() => {
    if ((isCreate || hash === userDrawerKeys.update) && !open) goBack();
  }, [goBack, hash, isCreate, open]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (isUpdate) {
      form.setFieldsValue({
        firstName: data.firstName,
        lastName: data.lastName,
        mobile: data.mobile,
      });
    }
  }, [data, form, isUpdate, open]);

  return (
    <FormDrawer
      afterOpenChange={(isOpen) => {
        if (isOpen) {
          if (isUpdate) {
            form.setFieldsValue({
              firstName: data.firstName,
              lastName: data.lastName,
              mobile: data.mobile,
            });
          }
          form.focusField("firstName");
        } else {
          form.resetFields();
        }
      }}
      onClose={() => {
        mutation.cancel();
        goBack();
      }}
      onSubmit={() => form.submit()}
      open={open}
      submitting={mutation.submitting}
      title={t(isUpdate ? "update" : "create")}
    >
      <Form<UserRequest>
        form={form}
        initialValues={isUpdate ? data : undefined}
        layout="vertical"
        onFinish={(values) => void handleSubmit(values)}
      >
        <Form.Item<UserRequest>
          label={t("firstName")}
          name="firstName"
          rules={[{ required: true, max: profileNameMaxLength }]}
        >
          <Input maxLength={profileNameMaxLength} />
        </Form.Item>
        <Form.Item<UserRequest>
          label={t("lastName")}
          name="lastName"
          rules={[{ required: true, max: profileNameMaxLength }]}
        >
          <Input maxLength={profileNameMaxLength} />
        </Form.Item>
        <Form.Item<UserRequest>
          label={t("mobile")}
          name="mobile"
          rules={[{ required: true }]}
        >
          <DigitsInput />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};
