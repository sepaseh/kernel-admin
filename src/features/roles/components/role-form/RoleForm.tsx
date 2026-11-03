import { Checkbox, Divider, Flex, Form, Input } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { createRole, updateRole } from "@/features/roles/api";
import { roleDrawerKeys } from "@/features/roles/constants";
import type {
  PermissionGroup,
  Role,
  RoleRequest,
} from "@/features/roles/types";
import {
  isCurrentMutationError,
  useGoBack,
  useMutationRequest,
} from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { FormDrawer } from "@/shared/ui/form-drawer";

type RoleFormProps = {
  data?: Role;
  onFinish: () => void;
  options: { permissions: PermissionGroup[] };
};

export const RoleForm = ({
  data,
  onFinish,
  options: { permissions },
}: RoleFormProps) => {
  const { t } = useTranslation();
  const { messageAPI } = useAntd();
  const { user } = useCore();
  const { canCreate, canUpdate } = getRoutePermissions("roles", user);
  const { hash, pathname, search } = useLocation();
  const [form] = Form.useForm<RoleRequest>();
  const goBack = useGoBack();
  const isUpdate = hash === roleDrawerKeys.update && !!data;
  const isCreate = hash === roleDrawerKeys.create;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);
  const mutation = useMutationRequest(
    JSON.stringify([pathname, search, hash, data?.id, user?.id]),
    open,
  );

  const handleSubmit = async (values: RoleRequest): Promise<void> => {
    if (!open) return;

    try {
      const result = await mutation.run((signal) =>
        isUpdate
          ? updateRole(data.id, values, signal)
          : createRole(values, signal),
      );
      if (!result?.isCurrent()) return;
      messageAPI.success(t(isUpdate ? "roleUpdated" : "roleCreated"));
      goBack();
      onFinish();
    } catch (error) {
      if (isCurrentMutationError(error))
        messageAPI.error(getErrorMessage(error.cause));
    }
  };

  useEffect(() => {
    if ((isCreate || hash === roleDrawerKeys.update) && !open) goBack();
  }, [goBack, hash, isCreate, open]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      isUpdate
        ? { name: data.name, permissions: data.permissions }
        : { name: undefined, permissions: [] },
    );
  }, [data, form, isUpdate, open]);

  return (
    <FormDrawer
      afterOpenChange={(isOpen) => {
        if (isOpen) {
          form.focusField("name");
        } else {
          form.resetFields();
        }
      }}
      autoFocus={false}
      onClose={() => {
        mutation.cancel();
        goBack();
      }}
      onSubmit={() => form.submit()}
      open={open}
      submitting={mutation.submitting}
      title={t(isUpdate ? "update" : "create")}
    >
      <Form<RoleRequest>
        form={form}
        initialValues={
          isUpdate
            ? { name: data.name, permissions: data.permissions }
            : { permissions: [] }
        }
        key={data?.id ?? "create"}
        layout="vertical"
        onFinish={(values) => void handleSubmit(values)}
      >
        <Form.Item<RoleRequest>
          label={t("name")}
          name="name"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<RoleRequest> label={t("permissions")} name="permissions">
          <Checkbox.Group
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {permissions.map((group) => (
              <Flex gap={8} key={group.name} vertical>
                <Divider
                  styles={{
                    content: { fontSize: 14, fontWeight: 400 },
                    root: { margin: 0 },
                  }}
                  titlePlacement="start"
                  variant="dashed"
                >
                  {group.title}
                </Divider>
                {group.permissions.map((permission) => (
                  <Checkbox key={permission.name} value={permission.name}>
                    {permission.title}
                  </Checkbox>
                ))}
              </Flex>
            ))}
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};
