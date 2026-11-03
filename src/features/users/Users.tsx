import type { TableProps } from "antd";
import {
  Button,
  Col,
  FloatButton,
  Form,
  Input,
  Row,
  Select,
  Table,
  Tooltip,
} from "antd";
import { useAntdToken } from "antd-style";
import {
  Check,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { fetchRoles } from "@/features/roles/api";
import type { Role } from "@/features/roles/types";
import { UserForm } from "@/features/users/components/user-form/UserForm";
import { UserRoleForm } from "@/features/users/components/user-role-form/UserRoleForm";
import { useFilterParams } from "@/features/users/hooks/useFilterParams";
import { useDebouncedFilters } from "@/features/users/hooks/useDebouncedFilters";
import { generatePassword } from "@/features/users/tools/password";
import { getAccessTokenVersion } from "@/shared/api/token";
import {
  isCurrentMutationError,
  useMutationRequest,
  useReadRequest,
  useReadResource,
} from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { ensureContrast } from "@/shared/lib/color-contrast";
import { DigitsInput } from "@/shared/ui/digits-input";
import { RequestFeedback } from "@/shared/ui/request-feedback";

import {
  deleteUser,
  fetchUser,
  fetchUsers,
  updateUserPassword,
  updateUserStatus,
  updateUserSystemAdmin,
} from "./api";
import { defaultPageSize, userDrawerKeys } from "./constants";
import type {
  User,
  UserListQuery,
  UserStatusRequest,
  UserSystemAdminRequest,
} from "./types";

export const UsersPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<UserListQuery>();
  const { messageAPI, modalAPI, notificationAPI } = useAntd();
  const { user } = useCore();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "users",
    user,
  );
  const { filters, setFilters } = useFilterParams<UserListQuery>();
  const { hash, pathname, search } = useLocation();
  const token = useAntdToken();
  const iconSurfaces = [token.colorBgContainer, token.colorBgLayout];
  const positiveIconColor = ensureContrast(token.colorSuccess, iconSurfaces, 3);
  const negativeIconColor = ensureContrast(token.colorError, iconSurfaces, 3);
  const navigate = useNavigate();
  const parsedOffset = Number(filters.offset ?? "0");
  const offset =
    Number.isSafeInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
  const current = Math.floor(offset / defaultPageSize) + 1;
  const isSystemAdmin = user?.isSystemAdmin ?? false;
  const hasActions = canDelete || canUpdate;
  const loadUsers = useCallback(
    (signal: AbortSignal) =>
      fetchUsers(
        {
          ...filters,
          offset: String(offset),
          size: String(defaultPageSize),
        },
        signal,
      ),
    [filters, offset],
  );
  const list = useReadResource(loadUsers);
  const roleOptions = useReadResource<Role[]>(fetchRoles, canUpdate);
  const details = useReadRequest<User>();
  const [detailTarget, setDetailTarget] = useState<{
    id: string;
    hash: typeof userDrawerKeys.roles | typeof userDrawerKeys.update;
  }>();
  const data = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const roles = roleOptions.data ?? [];
  const selectedData = details.data;
  const loading = list.loading || details.loading;
  const fetchData = list.reload;
  const mutation = useMutationRequest(
    JSON.stringify([
      pathname,
      search,
      hash,
      user?.id,
      canDelete,
      canUpdate,
      isSystemAdmin,
    ]),
    canDelete || canUpdate || isSystemAdmin,
  );
  const debouncedHandleFilter = useDebouncedFilters(setFilters);

  const openUserDrawer = async (
    id: User["id"],
    hash: typeof userDrawerKeys.roles | typeof userDrawerKeys.update,
  ) => {
    if (!canUpdate) return;
    setDetailTarget({ id, hash });
    const value = await details.run((signal) => fetchUser(id, signal));
    if (value) {
      void navigate({ hash, pathname, search }, { state: true });
    }
  };

  const handleStatus = (id: User["id"], params: UserStatusRequest) => {
    if (!canUpdate) return;
    modalAPI.confirm({
      onCancel: mutation.cancel,
      cancelText: t("no"),
      okText: t("yes"),
      onOk: async () => {
        try {
          const result = await mutation.run((signal) =>
            updateUserStatus(id, params, signal),
          );
          if (!result?.isCurrent()) return;
          messageAPI.success(t("statusUpdated"));
          await fetchData();
        } catch (error) {
          if (isCurrentMutationError(error))
            messageAPI.error(getErrorMessage(error.cause));
        }
      },
      title: t("statusConfirm"),
    });
  };

  const handlePassword = (id: User["id"]) => {
    if (!canUpdate) return;

    modalAPI.confirm({
      onCancel: mutation.cancel,
      cancelText: t("no"),
      okText: t("yes"),
      okType: "default",
      onOk: async () => {
        try {
          const loginVersion = getAccessTokenVersion();
          let appliedPassword: string | undefined;
          await mutation.run(async (signal) => {
            const password = generatePassword();
            await updateUserPassword(id, { password }, signal);
            appliedPassword = password;
          });
          if (!appliedPassword || getAccessTokenVersion() !== loginVersion)
            return;

          void navigator.clipboard
            ?.writeText(appliedPassword)
            .catch(() => undefined);
          notificationAPI.success({
            description: appliedPassword,
            message: t("password"),
          });
        } catch (error) {
          if (isCurrentMutationError(error))
            messageAPI.error(getErrorMessage(error.cause));
        }
      },
      title: t("passwordConfirm"),
    });
  };

  const handleSystemAdmin = (
    id: User["id"],
    params: UserSystemAdminRequest,
  ) => {
    if (!isSystemAdmin) return;
    modalAPI.confirm({
      onCancel: mutation.cancel,
      cancelText: t("no"),
      okText: t("yes"),
      onOk: async () => {
        try {
          const result = await mutation.run((signal) =>
            updateUserSystemAdmin(id, params, signal),
          );
          if (!result?.isCurrent()) return;
          messageAPI.success(t("systemAdminUpdated"));
          await fetchData();
        } catch (error) {
          if (isCurrentMutationError(error))
            messageAPI.error(getErrorMessage(error.cause));
        }
      },
      title: t("systemAdminConfirm"),
    });
  };

  const handleDelete = (id: User["id"]) => {
    if (!canDelete) return;
    modalAPI.confirm({
      onCancel: mutation.cancel,
      cancelText: t("no"),
      okButtonProps: { danger: true },
      okText: t("yes"),
      onOk: async () => {
        try {
          const result = await mutation.run((signal) => deleteUser(id, signal));
          if (!result?.isCurrent()) return;
          messageAPI.success(t("userDeleted"));
          await fetchData();
        } catch (error) {
          if (isCurrentMutationError(error))
            messageAPI.error(getErrorMessage(error.cause));
        }
      },
      title: t("deleteUserConfirm"),
    });
  };

  const tableColumns: TableProps<User>["columns"] = [
    {
      align: "center",
      key: "index",
      render: (_, _record, index) => offset + index + 1,
      title: t("row"),
      width: 60,
    },
    {
      key: "name",
      render: (_, record) => `${record.firstName} ${record.lastName}`,
      title: t("name"),
    },
    { align: "center", dataIndex: "mobile", title: t("mobile") },
    {
      align: "center",
      dataIndex: "email",
      render: (_, { email }) => email || "-",
      title: t("email"),
    },
    {
      align: "center",
      dataIndex: "username",
      render: (_, { username }) => username || "-",
      title: t("username"),
    },
    ...(isSystemAdmin
      ? ([
          {
            align: "center",
            dataIndex: "isSystemAdmin",
            render: (_, { id, isSystemAdmin }) => {
              const label = t(isSystemAdmin ? "yes" : "no");

              return (
                <Tooltip title={label}>
                  <Button
                    aria-label={label}
                    color={isSystemAdmin ? "green" : "red"}
                    style={{
                      color: isSystemAdmin
                        ? positiveIconColor
                        : negativeIconColor,
                    }}
                    icon={
                      isSystemAdmin ? (
                        <Check aria-hidden color="currentColor" size="1em" />
                      ) : (
                        <X aria-hidden color="currentColor" size="1em" />
                      )
                    }
                    onClick={() =>
                      handleSystemAdmin(id, { isSystemAdmin: !isSystemAdmin })
                    }
                    variant="link"
                  />
                </Tooltip>
              );
            },
            title: t("systemAdmin"),
            width: 120,
          },
        ] satisfies TableProps<User>["columns"])
      : []),
    {
      align: "center",
      dataIndex: "status",
      render: (_, { id, status }) => {
        const active = status === "active";
        const label = t(status);

        return (
          <Tooltip title={label}>
            {canUpdate ? (
              <Button
                aria-label={label}
                color={active ? "green" : "red"}
                style={{
                  color: active ? positiveIconColor : negativeIconColor,
                }}
                icon={
                  active ? (
                    <Check aria-hidden color="currentColor" size="1em" />
                  ) : (
                    <X aria-hidden color="currentColor" size="1em" />
                  )
                }
                onClick={() =>
                  handleStatus(id, {
                    status: active ? "inactive" : "active",
                  })
                }
                variant="link"
              />
            ) : (
              <span
                aria-label={label}
                role="img"
                style={{
                  color: active ? positiveIconColor : negativeIconColor,
                }}
              >
                {active ? (
                  <Check aria-hidden color="currentColor" size="1em" />
                ) : (
                  <X aria-hidden color="currentColor" size="1em" />
                )}
              </span>
            )}
          </Tooltip>
        );
      },
      title: t("status"),
      width: 120,
    },
    ...(hasActions
      ? [
          {
            align: "center" as const,
            key: "actions",
            render: (_: unknown, record: User) => (
              <>
                {canUpdate && (
                  <>
                    <Tooltip title={t("update")}>
                      <Button
                        aria-label={t("update")}
                        icon={
                          <Pencil aria-hidden color="currentColor" size="1em" />
                        }
                        onClick={() =>
                          openUserDrawer(record.id, userDrawerKeys.update)
                        }
                        type="text"
                      />
                    </Tooltip>
                    <Tooltip title={t("roles")}>
                      <Button
                        aria-label={t("roles")}
                        disabled={
                          roleOptions.loading ||
                          !!roleOptions.error ||
                          !roleOptions.data
                        }
                        icon={
                          <KeyRound
                            aria-hidden
                            color="currentColor"
                            size="1em"
                          />
                        }
                        onClick={() =>
                          openUserDrawer(record.id, userDrawerKeys.roles)
                        }
                        type="text"
                      />
                    </Tooltip>
                    <Tooltip title={t("password")}>
                      <Button
                        aria-label={t("password")}
                        icon={
                          <LockKeyhole
                            aria-hidden
                            color="currentColor"
                            size="1em"
                          />
                        }
                        onClick={() => handlePassword(record.id)}
                        type="text"
                      />
                    </Tooltip>
                  </>
                )}
                {canDelete && (
                  <Tooltip title={t("delete")}>
                    <Button
                      aria-label={t("delete")}
                      icon={
                        <Trash2 aria-hidden color="currentColor" size="1em" />
                      }
                      onClick={() => handleDelete(record.id)}
                      type="text"
                    />
                  </Tooltip>
                )}
              </>
            ),
            title: t("action"),
            width: 160,
          },
        ]
      : []),
  ];

  useEffect(() => {
    form.resetFields();
    form.setFieldsValue(filters);
  }, [filters, form]);

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
          error={roleOptions.error}
          hasData={!!roleOptions.data}
          loading={roleOptions.loading}
          retry={roleOptions.reload}
        />
        <RequestFeedback
          error={details.error}
          loading={details.loading}
          retry={() =>
            detailTarget && openUserDrawer(detailTarget.id, detailTarget.hash)
          }
        />
        <Form<UserListQuery>
          form={form}
          onValuesChange={(_, values) =>
            debouncedHandleFilter({ ...values, offset: undefined })
          }
        >
          <Row gutter={24}>
            <Col xs={24} sm={12} md={8} lg={6} xxl={4} xxxl={3}>
              <Form.Item<UserListQuery> name="firstName">
                <Input allowClear placeholder={t("firstName")} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xxl={4} xxxl={3}>
              <Form.Item<UserListQuery> name="lastName">
                <Input allowClear placeholder={t("lastName")} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xxl={4} xxxl={3}>
              <Form.Item<UserListQuery> name="email">
                <Input allowClear placeholder={t("email")} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xxl={4} xxxl={3}>
              <Form.Item<UserListQuery> name="mobile">
                <DigitsInput allowClear placeholder={t("mobile")} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xxl={4} xxxl={3}>
              <Form.Item<UserListQuery> name="username">
                <Input allowClear placeholder={t("username")} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xxl={4} xxxl={3}>
              <Form.Item<UserListQuery> name="status">
                <Select
                  aria-label={t("status")}
                  allowClear
                  options={[
                    { label: t("active"), value: "active" },
                    { label: t("inactive"), value: "inactive" },
                  ]}
                  placeholder={t("status")}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {(!list.error || list.data) && (
          <section
            aria-label={t("users")}
            style={{ overflowX: "auto" }}
            tabIndex={0}
          >
            <Table<User>
              columns={tableColumns}
              dataSource={data}
              loading={loading}
              onChange={({ current: page }) =>
                setFilters({
                  ...filters,
                  offset: String(((page ?? 1) - 1) * defaultPageSize),
                })
              }
              pagination={{
                current,
                pageSize: defaultPageSize,
                showSizeChanger: false,
                total,
              }}
              rowKey="id"
              size="small"
              styles={{ content: { minWidth: token.screenXL } }}
            />
          </section>
        )}
      </div>
      {canCreate && (
        <FloatButton
          aria-label={t("create")}
          icon={<Plus aria-hidden color="currentColor" size="1em" />}
          onClick={() =>
            navigate(
              { hash: userDrawerKeys.create, pathname, search },
              { state: true },
            )
          }
          tooltip={t("create")}
          type="primary"
        />
      )}
      <UserForm data={selectedData} onFinish={fetchData} />
      {roleOptions.data && !roleOptions.error && (
        <UserRoleForm
          data={selectedData}
          onFinish={fetchData}
          options={{ roles }}
        />
      )}
    </>
  );
};
