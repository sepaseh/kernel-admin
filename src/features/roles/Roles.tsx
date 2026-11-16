import {
  Button,
  Flex,
  FloatButton,
  Table,
  type TableProps,
  Tooltip,
} from "antd";
import { isCancel } from "axios";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock } from "@/shared/hooks";

import { deleteRole, fetchPermissions, fetchRoles } from "./api";
import { RoleForm } from "./components/role-form/RoleForm";
import type { PermissionGroup, Role } from "./types";

export const RolesPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionGroup[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<Role["id"]>();
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI, modalAPI } = useAntd();
  const { pathname, search } = useLocation();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "roles",
    currentUser,
  );

  const fetchData = useCallback(async () => {
    const signal = start();
    setLoading(true);

    try {
      const data = await fetchRoles(signal);
      if (signal.aborted) return;

      setRoles(data);
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [messageAPI, start]);

  const handleDelete = (id: Role["id"]) => {
    if (!canDelete || submitting) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okText: t("yes"),
      okButtonProps: { danger: true },
      title: t("deleteRoleConfirm"),
      onOk: async () => {
        if (!lock()) return;

        setSubmitting(true);

        try {
          await deleteRole(id);
          void messageAPI.success(t("roleDeleted"));
          await fetchData();
        } catch (error) {
          if (error instanceof Error) void messageAPI.error(error.message);
          throw error;
        } finally {
          setSubmitting(false);
          unlock();
        }
      },
    });
  };

  const handleUpdate = (id: Role["id"]) => {
    if (!canUpdate || submitting) return;

    setSelectedId(id);
    void navigate(
      { hash: modalKeys.update, pathname, search },
      { state: true },
    );
  };

  const columns: TableProps<Role>["columns"] = [
    {
      align: "center",
      key: "index",
      render: (_, _record, index) => index + 1,
      title: t("row"),
      width: 60,
    },
    {
      dataIndex: "name",
      title: t("name"),
    },
    {
      align: "center",
      dataIndex: "permissions",
      render: (_, role) => role.permissions.length,
      title: t("permissions"),
      width: 120,
    },
    ...(canUpdate || canDelete
      ? ([
          {
            align: "center",
            key: "actions",
            title: t("action"),
            width: 80,
            render: (_, { id }) => (
              <Flex justify="center">
                {canUpdate && (
                  <Tooltip title={t("update")}>
                    <Button
                      aria-label={t("update")}
                      disabled={submitting}
                      icon={<Pencil aria-hidden size="1em" />}
                      onClick={() => handleUpdate(id)}
                      type="text"
                    />
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title={t("delete")}>
                    <Button
                      aria-label={t("delete")}
                      disabled={submitting}
                      icon={<Trash2 aria-hidden size="1em" />}
                      onClick={() => handleDelete(id)}
                      type="text"
                    />
                  </Tooltip>
                )}
              </Flex>
            ),
          },
        ] satisfies TableProps<Role>["columns"])
      : []),
  ];

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
    return cancel;
  }, [cancel, fetchData]);

  useEffect(() => {
    if (!canCreate && !canUpdate) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const data = await fetchPermissions(controller.signal);
        if (controller.signal.aborted) return;

        setPermissions(data);
      } catch (error) {
        if (controller.signal.aborted || isCancel(error)) return;

        if (error instanceof Error) void messageAPI.error(error.message);
      }
    })();
    return () => controller.abort();
  }, [canCreate, canUpdate, messageAPI]);

  return (
    <>
      <Table<Role>
        columns={columns}
        dataSource={roles}
        loading={loading}
        pagination={false}
        rowKey="id"
        size="small"
      />
      {canCreate && (
        <FloatButton
          aria-label={t("create")}
          disabled={submitting}
          icon={<Plus aria-hidden size="1em" />}
          onClick={() =>
            void navigate(
              { hash: modalKeys.create, pathname, search },
              { state: true },
            )
          }
          tooltip={t("create")}
          type="primary"
        />
      )}
      <RoleForm
        id={selectedId}
        onFinish={fetchData}
        options={{ permissions }}
      />
    </>
  );
};
