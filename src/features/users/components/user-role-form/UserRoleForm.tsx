import { Checkbox, Form, type FormProps } from "antd";
import { isCancel } from "axios";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { Role } from "@/features/roles";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useGoBack, useLock } from "@/shared/hooks";
import { FormDrawer } from "@/shared/ui/form-drawer";

import { fetchUser, updateUserRoles } from "../../api";
import type { User, UserRoleRequest } from "../../types";

type UserRoleFormProps = {
  id?: User["id"];
  onFinish: () => void;
  options: { roles: Role[] };
};

const initialFocusField = "roleIds" satisfies keyof UserRoleRequest;

export const UserRoleForm = ({
  id,
  onFinish,
  options: { roles },
}: UserRoleFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<UserRoleRequest>();
  const [loadedId, setLoadedId] = useState<User["id"]>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const goBack = useGoBack();
  const { hash } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canUpdate } = getRoutePermissions("users", currentUser);
  const isRoles = hash === modalKeys.roles;
  const open = isRoles && canUpdate;

  const handleClose = () => {
    cancel();
    goBack();
  };

  const handleSubmit: FormProps<UserRoleRequest>["onFinish"] = async (
    values,
  ) => {
    if (
      !open ||
      loading ||
      submitting ||
      id === undefined ||
      loadedId !== id ||
      !lock()
    )
      return;

    const signal = start();
    setSubmitting(true);

    try {
      await updateUserRoles(id, values, signal);
      if (signal.aborted) return;

      void messageAPI.success(t("rolesUpdated"));
      void onFinish();
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

  useLayoutEffect(() => cancel, [cancel, goBack, id, isRoles, open]);

  useEffect(() => {
    void (async () => {
      setLoadedId(undefined);
      setLoading(false);
      setSubmitting(false);
      unlock();

      if (!open) {
        if (isRoles) goBack();

        return;
      }

      if (id === undefined) {
        goBack();
        return;
      }

      const signal = start();
      setLoading(true);
      try {
        const data = await fetchUser(id, signal);
        if (signal.aborted) return;

        form.setFieldsValue({ roleIds: data.roles.map(({ id }) => id) });
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
  }, [cancel, form, goBack, id, isRoles, messageAPI, open, start, unlock]);

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
      submitDisabled={
        loading || submitting || id === undefined || loadedId !== id
      }
      submitting={submitting}
      title={t("roles")}
    >
      <Form<UserRoleRequest>
        disabled={loading || submitting}
        form={form}
        initialValues={{ roleIds: [] }}
        layout="vertical"
        name="user-role-form"
        onFinish={handleSubmit}
      >
        <Form.Item<UserRoleRequest> name="roleIds">
          <Checkbox.Group
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
            options={roles.map(({ id, name }) => ({ label: name, value: id }))}
          />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};
