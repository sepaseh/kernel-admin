import type { TableProps } from "antd";
import { Button, Flex, FloatButton, Table, Tooltip } from "antd";
import { useAntdToken } from "antd-style";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { RoleForm } from "@/features/roles/components/role-form/RoleForm";
import {
  isCurrentMutationError,
  useMutationRequest,
  useReadRequest,
  useReadResource,
} from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { RequestFeedback } from "@/shared/ui/request-feedback";

import { deleteRole, fetchPermissions, fetchRole, fetchRoles } from "./api";
import { roleDrawerKeys } from "./constants";
import type { PermissionGroup, Role } from "./types";

export const RolesPage = () => {
  const { t } = useTranslation();
  const { messageAPI, modalAPI } = useAntd();
  const { user } = useCore();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "roles",
    user,
  );
  const { hash, pathname, search } = useLocation();
  const token = useAntdToken();
  const navigate = useNavigate();

  const list = useReadResource(fetchRoles);
  const permissionOptions = useReadResource<PermissionGroup[]>(
    fetchPermissions,
    canCreate || canUpdate,
  );
  const details = useReadRequest<Role>();
  const [detailTarget, setDetailTarget] = useState<string>();
  const data = list.data ?? [];
  const permissions = permissionOptions.data ?? [];
  const selectedData = details.data;
  const loading = list.loading || details.loading;
  const fetchData = list.reload;
  const mutation = useMutationRequest(
    JSON.stringify([pathname, search, hash, user?.id, canDelete]),
    canDelete,
  );

  const handleUpdate = async (id: Role["id"]) => {
    if (!canUpdate) return;
    setDetailTarget(id);
    const value = await details.run((signal) => fetchRole(id, signal));
    if (value) {
      void navigate(
        { hash: roleDrawerKeys.update, pathname, search },
        { state: true },
      );
    }
  };

  const handleDelete = (id: Role["id"]) => {
    if (!canDelete) return;
    modalAPI.confirm({
      onCancel: mutation.cancel,
      cancelText: t("no"),
      okButtonProps: { danger: true },
      okText: t("yes"),
      onOk: async () => {
        try {
          const result = await mutation.run((signal) => deleteRole(id, signal));
          if (!result?.isCurrent()) return;
          messageAPI.success(t("roleDeleted"));
          await fetchData();
        } catch (error) {
          if (isCurrentMutationError(error))
            messageAPI.error(getErrorMessage(error.cause));
        }
      },
      title: t("deleteRoleConfirm"),
    });
  };

  const tableColumns: TableProps<Role>["columns"] = [
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
      render: (_, { permissions }) => permissions.length,
      title: t("permissions"),
      width: 120,
    },
    {
      align: "center",
      key: "actions",
      render: (_, record) => (
        <Flex justify="center">
          {canUpdate && (
            <Tooltip title={t("update")}>
              <Button
                aria-label={t("update")}
                disabled={
                  permissionOptions.loading ||
                  !!permissionOptions.error ||
                  !permissionOptions.data
                }
                icon={<Pencil aria-hidden color="currentColor" size="1em" />}
                onClick={() => handleUpdate(record.id)}
                type="text"
              />
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title={t("delete")}>
              <Button
                aria-label={t("delete")}
                icon={<Trash2 aria-hidden color="currentColor" size={14} />}
                onClick={() => handleDelete(record.id)}
                type="text"
              />
            </Tooltip>
          )}
        </Flex>
      ),
      title: t("action"),
      width: 80,
    },
  ];

  useEffect(() => details.cancel, [details.cancel, hash, pathname, search]);

  return (
    <>
      <div
        style={{
          flexGrow: 1,
          minWidth: 0,
        }}
      >
        <RequestFeedback
          error={list.error}
          hasData={!!list.data}
          loading={list.loading}
          retry={list.reload}
        />
        <RequestFeedback
          error={permissionOptions.error}
          hasData={!!permissionOptions.data}
          loading={permissionOptions.loading}
          retry={permissionOptions.reload}
        />
        <RequestFeedback
          error={details.error}
          loading={details.loading}
          retry={() => detailTarget && handleUpdate(detailTarget)}
        />
        {(!list.error || list.data) && (
          <Table<Role>
            columns={tableColumns}
            dataSource={data}
            loading={loading}
            pagination={false}
            rowKey="id"
            scroll={{ x: token.screenMD }}
            size="small"
          />
        )}
      </div>
      {canCreate && (
        <FloatButton
          aria-label={t("create")}
          disabled={
            permissionOptions.loading ||
            !!permissionOptions.error ||
            !permissionOptions.data
          }
          icon={<Plus aria-hidden color="currentColor" size="1em" />}
          onClick={() =>
            navigate(
              { hash: roleDrawerKeys.create, pathname, search },
              { state: true },
            )
          }
          tooltip={t("create")}
          type="primary"
        />
      )}
      {permissionOptions.data && !permissionOptions.error && (
        <RoleForm
          data={selectedData}
          onFinish={fetchData}
          options={{ permissions }}
        />
      )}
    </>
  );
};
