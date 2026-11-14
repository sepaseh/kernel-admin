import {
  Button,
  Col,
  FloatButton,
  Form,
  Input,
  Row,
  Select,
  Table,
  type TableProps,
  Tooltip,
} from "antd";
import { isCancel } from "axios";
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
import { useLocation, useNavigate, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { fetchRoles, type Role } from "@/features/roles";
import type { DefaultLayoutContext } from "@/layouts/default";
import { defaultPageSize, modalKeys } from "@/shared/config";
import {
  useAbortController,
  useDebouncedFilters,
  useFilterParams,
  useLock,
} from "@/shared/hooks";
import { generatePassword, getAllowedValue, getPage } from "@/shared/lib";
import { DigitsInput } from "@/shared/ui/digits-input";

import {
  deleteUser,
  fetchUsers,
  updateUserPassword,
  updateUserSystemAdmin,
} from "./api";
import { UserForm } from "./components/user-form";
import { UserRoleForm } from "./components/user-role-form";
import { userStatuses } from "./constants";
import type { User, UserQuery, UserSystemAdminRequest } from "./types";

export const UsersPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<UserQuery>();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<User["id"]>();
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const { cancel, start } = useAbortController();
  const { messageAPI, modalAPI, notificationAPI, token } = useAntd();
  const { filters, setFilters } = useFilterParams<UserQuery>();
  const debouncedHandleFilter = useDebouncedFilters(setFilters);
  const { pathname, search } = useLocation();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "users",
    currentUser,
  );
  const current = getPage(filters.page);

  const fetchData = useCallback(async () => {
    const signal = start();
    setLoading(true);

    try {
      const data = await fetchUsers(
        {
          ...filters,
          status: getAllowedValue(filters.status, userStatuses),
        },
        signal,
      );
      if (signal.aborted) return;

      setUsers(data.items);
      setTotal(data.total);
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filters, messageAPI, start]);

  const handleDelete = async (id: User["id"]) => {
    if (!lock()) return;

    setSubmitting(true);

    try {
      await deleteUser(id);
      void messageAPI.success(t("userDeleted"));
    } catch (error) {
      if (error instanceof Error) void messageAPI.error(error.message);
      throw error;
    } finally {
      setSubmitting(false);
      unlock();
    }
  };

  const handlePassword = async (id: User["id"]) => {
    if (!lock()) return;

    setSubmitting(true);

    try {
      const password = generatePassword();
      await updateUserPassword(id, { password });
      notificationAPI.success({
        description: password,
        title: t("password"),
      });

      try {
        await navigator.clipboard?.writeText(password);
      } catch {
        // The generated password remains available in the notification.
      }

      return password;
    } catch (error) {
      if (error instanceof Error) void messageAPI.error(error.message);
      throw error;
    } finally {
      setSubmitting(false);
      unlock();
    }
  };

  const handleSystemAdmin = async (
    id: User["id"],
    params: UserSystemAdminRequest,
  ) => {
    if (!lock()) return;

    setSubmitting(true);

    try {
      await updateUserSystemAdmin(id, params);
      void messageAPI.success(t("systemAdminUpdated"));
    } catch (error) {
      if (error instanceof Error) void messageAPI.error(error.message);
      throw error;
    } finally {
      setSubmitting(false);
      unlock();
    }
  };

  const handleDeleteConfirm = (id: User["id"]) => {
    if (!canDelete || submitting) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okButtonProps: { danger: true },
      okText: t("yes"),
      onOk: async () => {
        await handleDelete(id);
        await fetchData();
      },
      title: t("deleteUserConfirm"),
    });
  };

  const handlePasswordConfirm = (id: User["id"]) => {
    if (!canUpdate || submitting) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okText: t("yes"),
      onOk: async () => await handlePassword(id),
      title: t("passwordConfirm"),
    });
  };

  const handleSystemAdminConfirm = (id: User["id"], isSystemAdmin: boolean) => {
    if (!currentUser.isSystemAdmin || submitting) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okText: t("yes"),
      onOk: async () => {
        await handleSystemAdmin(id, { isSystemAdmin });
        await fetchData();
      },
      title: t("systemAdminConfirm"),
    });
  };

  const openUserDrawer = (
    id: User["id"],
    drawer: typeof modalKeys.roles | typeof modalKeys.update,
  ) => {
    if (!canUpdate || submitting) return;

    setSelectedId(id);
    void navigate({ hash: drawer, pathname, search }, { state: true });
  };

  const tableColumns: TableProps<User>["columns"] = [
    {
      align: "center",
      key: "index",
      render: (_, _record, index) =>
        (current - 1) * defaultPageSize + index + 1,
      title: t("row"),
      width: 60,
    },
    {
      key: "name",
      render: (_, { firstName, lastName }) => `${firstName} ${lastName}`,
      title: t("name"),
    },
    {
      align: "center",
      dataIndex: "mobile",
      title: t("mobile"),
    },
    ...(currentUser.isSystemAdmin
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
                    disabled={submitting}
                    icon={
                      isSystemAdmin ? (
                        <Check aria-hidden color="currentColor" size="1em" />
                      ) : (
                        <X aria-hidden color="currentColor" size="1em" />
                      )
                    }
                    onClick={() => handleSystemAdminConfirm(id, !isSystemAdmin)}
                    style={{
                      color: isSystemAdmin
                        ? token.colorSuccess
                        : token.colorError,
                    }}
                    variant="link"
                  />
                </Tooltip>
              );
            },
            title: t("systemAdmin"),
          },
        ] satisfies TableProps<User>["columns"])
      : []),
    {
      align: "center",
      dataIndex: "status",
      render: (_, { status }) => (
        <Tooltip title={t(status)}>
          <span
            aria-label={t(status)}
            role="img"
            style={{
              color:
                status === "active" ? token.colorSuccess : token.colorError,
            }}
          >
            {status === "active" ? (
              <Check aria-hidden size="1em" />
            ) : (
              <X aria-hidden size="1em" />
            )}
          </span>
        </Tooltip>
      ),
      title: t("status"),
      width: 120,
    },
    ...(canDelete || canUpdate
      ? ([
          {
            align: "center",
            key: "actions",
            render: (_, { id }) => (
              <>
                {canUpdate && (
                  <>
                    <Tooltip title={t("update")}>
                      <Button
                        aria-label={t("update")}
                        disabled={submitting}
                        icon={
                          <Pencil aria-hidden color="currentColor" size="1em" />
                        }
                        onClick={() => openUserDrawer(id, modalKeys.update)}
                        type="text"
                      />
                    </Tooltip>
                    <Tooltip title={t("roles")}>
                      <Button
                        aria-label={t("roles")}
                        disabled={submitting}
                        icon={
                          <KeyRound
                            aria-hidden
                            color="currentColor"
                            size="1em"
                          />
                        }
                        onClick={() => openUserDrawer(id, modalKeys.roles)}
                        type="text"
                      />
                    </Tooltip>
                    <Tooltip title={t("password")}>
                      <Button
                        aria-label={t("password")}
                        disabled={submitting}
                        icon={
                          <LockKeyhole
                            aria-hidden
                            color="currentColor"
                            size="1em"
                          />
                        }
                        onClick={() => handlePasswordConfirm(id)}
                        type="text"
                      />
                    </Tooltip>
                  </>
                )}
                {canDelete && (
                  <Tooltip title={t("delete")}>
                    <Button
                      aria-label={t("delete")}
                      disabled={submitting}
                      icon={
                        <Trash2 aria-hidden color="currentColor" size="1em" />
                      }
                      onClick={() => handleDeleteConfirm(id)}
                      type="text"
                    />
                  </Tooltip>
                )}
              </>
            ),
            title: t("action"),
            width: 160,
          },
        ] satisfies TableProps<User>["columns"])
      : []),
  ];

  useEffect(() => {
    if (!canUpdate) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const roles = await fetchRoles(controller.signal);
        if (controller.signal.aborted) return;

        setRoles(roles);
      } catch (error) {
        if (controller.signal.aborted || isCancel(error)) return;

        if (error instanceof Error) void messageAPI.error(error.message);
      }
    })();

    return () => controller.abort();
  }, [canUpdate, messageAPI]);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();

    return cancel;
  }, [cancel, fetchData]);

  useEffect(() => {
    form.resetFields();
    form.setFieldsValue({
      firstName: filters.firstName,
      lastName: filters.lastName,
      mobile: filters.mobile,
      status: getAllowedValue(filters.status, userStatuses),
    });
  }, [filters, form]);

  return (
    <>
      <Form<UserQuery>
        disabled={submitting}
        form={form}
        name="users-filter"
        onValuesChange={(_, values) =>
          debouncedHandleFilter({ ...values, page: undefined })
        }
      >
        <Row gutter={token.marginLG}>
          <Col lg={6} md={8} sm={12} xs={24} xxl={4} xxxl={3}>
            <Form.Item<UserQuery> name="firstName">
              <Input
                allowClear
                aria-label={t("firstName")}
                placeholder={t("firstName")}
              />
            </Form.Item>
          </Col>
          <Col lg={6} md={8} sm={12} xs={24} xxl={4} xxxl={3}>
            <Form.Item<UserQuery> name="lastName">
              <Input
                allowClear
                aria-label={t("lastName")}
                placeholder={t("lastName")}
              />
            </Form.Item>
          </Col>
          <Col lg={6} md={8} sm={12} xs={24} xxl={4} xxxl={3}>
            <Form.Item<UserQuery> name="mobile">
              <DigitsInput
                allowClear
                aria-label={t("mobile")}
                placeholder={t("mobile")}
              />
            </Form.Item>
          </Col>
          <Col lg={6} md={8} sm={12} xs={24} xxl={4} xxxl={3}>
            <Form.Item<UserQuery> name="status">
              <Select
                allowClear
                aria-label={t("status")}
                options={userStatuses.map((value) => ({
                  label: t(value),
                  value,
                }))}
                placeholder={t("status")}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      <Table<User>
        columns={tableColumns}
        dataSource={users}
        loading={loading}
        pagination={{
          current,
          disabled: submitting,
          onChange: (page) => setFilters({ page: String(page) }),
          pageSize: defaultPageSize,
          showSizeChanger: false,
          total: total,
        }}
        rowKey="id"
        size="small"
      />
      {canCreate && (
        <FloatButton
          aria-label={t("create")}
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
      <UserForm id={selectedId} onFinish={fetchData} />
      <UserRoleForm id={selectedId} onFinish={fetchData} options={{ roles }} />
    </>
  );
};
