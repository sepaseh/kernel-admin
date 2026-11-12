import { Checkbox, Divider, Flex, Form, type FormProps, Input } from "antd";
import { isCancel } from "axios";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useGoBack, useLock } from "@/shared/hooks";
import { FormDrawer } from "@/shared/ui/form-drawer";

import { createRole, fetchRole, updateRole } from "../../api";
import type {
  PermissionGroup,
  PermissionKey,
  Role,
  RoleRequest,
} from "../../types";

type RoleFormProps = {
  id?: Role["id"];
  onFinish: () => void;
  options: { permissions: PermissionGroup[] };
};

const initialFocusField = "name" satisfies keyof RoleRequest;

export const RoleForm = ({
  id,
  onFinish,
  options: { permissions },
}: RoleFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<RoleRequest>();
  const [loadedId, setLoadedId] = useState<Role["id"]>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const goBack = useGoBack();
  const { hash } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canCreate, canUpdate } = getRoutePermissions("roles", currentUser);
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);

  const handleClose = () => {
    cancel();
    goBack();
  };

  const handleGroupToggle = (
    names: PermissionKey[],
    checked: boolean,
    selectedPermissions: PermissionKey[],
  ) => {
    const nextPermissions = new Set(selectedPermissions);
    for (const name of names) {
      if (checked) nextPermissions.add(name);
      else nextPermissions.delete(name);
    }

    form.setFieldValue("permissions", [...nextPermissions]);
  };

  const handleSubmit: FormProps<RoleRequest>["onFinish"] = async (values) => {
    if (
      !open ||
      loading ||
      submitting ||
      (isUpdate && loadedId !== id) ||
      !lock()
    )
      return;

    const signal = start();
    setSubmitting(true);

    try {
      if (isUpdate) {
        if (id === undefined) return;

        await updateRole(id, values, signal);
        if (signal.aborted) return;

        void messageAPI.success(t("roleUpdated"));
      } else {
        await createRole(values, signal);
        if (signal.aborted) return;

        void messageAPI.success(t("roleCreated"));
      }

      onFinish();
      handleClose();
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

  useLayoutEffect(() => cancel, [cancel, goBack, id, isCreate, isUpdate, open]);

  useEffect(() => {
    void (async () => {
      setLoadedId(undefined);
      setLoading(false);
      setSubmitting(false);
      unlock();

      if (!open) {
        if (isCreate || isUpdate) goBack();

        return;
      }

      if (!isUpdate) return;

      if (id === undefined) {
        goBack();
        return;
      }

      const signal = start();
      setLoading(true);

      try {
        const data = await fetchRole(id, signal);
        if (signal.aborted) return;

        form.setFieldsValue({ name: data.name, permissions: data.permissions });
        setLoadedId(data.id);
      } catch (error) {
        if (signal.aborted) return;

        if (error instanceof Error) void messageAPI.error(error.message);
        goBack();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();

    return cancel;
  }, [
    cancel,
    form,
    goBack,
    id,
    isCreate,
    isUpdate,
    messageAPI,
    open,
    start,
    unlock,
  ]);

  return (
    <FormDrawer
      afterOpenChange={(open) => {
        if (!open) {
          form.resetFields();
          return;
        }

        form.focusField(initialFocusField);
      }}
      loading={loading}
      onClose={handleClose}
      onSubmit={() => form.submit()}
      open={open}
      submitDisabled={loading || submitting || (isUpdate && loadedId !== id)}
      submitting={submitting}
      title={t(isUpdate ? "update" : "create")}
    >
      <Form<RoleRequest>
        disabled={loading || submitting}
        form={form}
        initialValues={{ permissions: [] }}
        layout="vertical"
        name="role-form"
        onFinish={handleSubmit}
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
            {permissions.map((group) => {
              const names = group.permissions.map(({ name }) => name);

              return (
                <Flex gap={8} key={group.name} vertical>
                  <Divider
                    ref={(node) =>
                      node?.nativeElement.setAttribute("role", "presentation")
                    }
                    styles={{
                      content: { fontSize: 14, fontWeight: 400 },
                      root: { margin: 0 },
                    }}
                    titlePlacement="start"
                    variant="dashed"
                  >
                    <Form.Item<RoleRequest>
                      noStyle
                      shouldUpdate={(previous, next) =>
                        previous.permissions !== next.permissions
                      }
                    >
                      {({ getFieldsValue }) => {
                        const { permissions: selected = [] } = getFieldsValue();
                        const selectedSet = new Set(selected);
                        const count = names.filter((name) =>
                          selectedSet.has(name),
                        ).length;

                        return (
                          <Checkbox
                            checked={names.length > 0 && count === names.length}
                            indeterminate={count > 0 && count < names.length}
                            onChange={({ target: { checked } }) =>
                              handleGroupToggle(names, checked, selected)
                            }
                            skipGroup
                          >
                            {group.title}
                          </Checkbox>
                        );
                      }}
                    </Form.Item>
                  </Divider>
                  {group.permissions.map((permission) => (
                    <Checkbox key={permission.name} value={permission.name}>
                      {permission.title}
                    </Checkbox>
                  ))}
                </Flex>
              );
            })}
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};
