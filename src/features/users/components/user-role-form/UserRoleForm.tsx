import { Form, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { Role } from "@/features/roles/types";
import { updateUserRoles } from "@/features/users/api";
import { userDrawerKeys } from "@/features/users/constants";
import type { User, UserRoleRequest } from "@/features/users/types";
import {
  isCurrentMutationError,
  useGoBack,
  useMutationRequest,
} from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { FormDrawer } from "@/shared/ui/form-drawer";

type UserRoleFormProps = {
  data?: User;
  onFinish: () => void;
  options: { roles: Role[] };
};

export const UserRoleForm = ({
  data,
  onFinish,
  options: { roles },
}: UserRoleFormProps) => {
  const { t } = useTranslation();
  const { messageAPI } = useAntd();
  const { user } = useCore();
  const { canUpdate } = getRoutePermissions("users", user);
  const { hash, pathname, search } = useLocation();
  const [form] = Form.useForm<UserRoleRequest>();
  const goBack = useGoBack();
  const open = hash === userDrawerKeys.roles && !!data && canUpdate;
  const mutation = useMutationRequest(
    JSON.stringify([pathname, search, hash, data?.id, user?.id]),
    open,
  );

  const handleSubmit = async (values: UserRoleRequest): Promise<void> => {
    if (!open || !data) return;

    try {
      const result = await mutation.run((signal) =>
        updateUserRoles(data.id, values, signal),
      );
      if (!result?.isCurrent()) return;
      messageAPI.success(t("rolesUpdated"));
      goBack();
      onFinish();
    } catch (error) {
      if (isCurrentMutationError(error))
        messageAPI.error(getErrorMessage(error.cause));
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) return;

    form.focusField("roleIds");
  };

  useEffect(() => {
    if (hash === userDrawerKeys.roles && !open) goBack();
  }, [goBack, hash, open]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    if (data) {
      form.setFieldsValue({ roleIds: data.roles.map(({ id }) => id) });
    }
  }, [data, form, open]);

  return (
    <FormDrawer
      afterOpenChange={handleOpenChange}
      autoFocus={false}
      onClose={() => {
        mutation.cancel();
        goBack();
      }}
      onSubmit={() => form.submit()}
      open={open}
      submitting={mutation.submitting}
      title={t("roles")}
    >
      <Form<UserRoleRequest>
        form={form}
        layout="vertical"
        onFinish={(values) => void handleSubmit(values)}
      >
        <Form.Item label={t("roles")} name="roleIds">
          <Select
            mode="multiple"
            options={roles.map(({ id, name }) => ({
              label: name,
              value: id,
            }))}
          />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};
