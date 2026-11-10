import {
  Button,
  Col,
  Flex,
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
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import {
  type ContentCategory,
  fetchContentCategories,
} from "@/features/content-categories";
import type { DefaultLayoutContext } from "@/layouts/default";
import { defaultPageSize, modalKeys } from "@/shared/config";
import {
  useAbortController,
  useDebouncedFilters,
  useFilterParams,
  useLock,
} from "@/shared/hooks";
import { getPage } from "@/shared/lib";

import { deleteContent, fetchContents } from "./api";
import { ContentForm } from "./components/content-form/ContentForm";
import type { Content, ContentQuery } from "./types";

export const ContentsPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ContentQuery>();
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<Content["id"]>();
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(0);
  const { cancel, start } = useAbortController();
  const { messageAPI, modalAPI, token } = useAntd();
  const { filters, setFilters } = useFilterParams<ContentQuery>();
  const debouncedHandleFilter = useDebouncedFilters(setFilters);
  const { pathname, search } = useLocation();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "contents",
    currentUser,
  );
  const current = getPage(filters.page);

  const fetchData = useCallback(async () => {
    const signal = start();
    setLoading(true);

    try {
      const data = await fetchContents(filters, signal);
      if (signal.aborted) return;

      setContents(data.items);
      setTotal(data.total);
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filters, messageAPI, start]);

  const handleDelete = (id: Content["id"]) => {
    if (!canDelete || submitting) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okText: t("yes"),
      okButtonProps: { danger: true },
      title: t("deleteConfirm"),
      onOk: async () => {
        if (!lock()) return;

        setSubmitting(true);

        try {
          await deleteContent(id);
          void messageAPI.success(t("deleted"));
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

  const handleUpdate = (id: Content["id"]) => {
    if (!canUpdate || submitting) return;

    setSelectedId(id);
    void navigate(
      { hash: modalKeys.update, pathname, search },
      { state: true },
    );
  };

  const columns: TableProps<Content>["columns"] = [
    {
      align: "center",
      key: "index",
      render: (_, _record, index) =>
        (current - 1) * defaultPageSize + index + 1,
      title: t("row"),
      width: 60,
    },
    {
      dataIndex: "title",
      title: t("title"),
    },
    {
      align: "center",
      dataIndex: "contentCategory",
      render: (_, { contentCategory }) => contentCategory.name,
      title: t("category"),
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
        ] satisfies TableProps<Content>["columns"])
      : []),
  ];

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const data = await fetchContentCategories(controller.signal);
        if (controller.signal.aborted) return;

        setCategories(data);
      } catch (error) {
        if (controller.signal.aborted || isCancel(error)) return;

        if (error instanceof Error) void messageAPI.error(error.message);
      }
    })();
    return () => controller.abort();
  }, [messageAPI]);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
    return cancel;
  }, [cancel, fetchData]);

  useEffect(() => {
    form.setFieldsValue({
      title: filters.title,
      contentCategoryId: filters.contentCategoryId,
    });
  }, [filters, form]);

  return (
    <>
      <Form<ContentQuery>
        disabled={submitting}
        form={form}
        name="contents-filter"
        onValuesChange={(_, values) =>
          debouncedHandleFilter({ ...values, page: undefined })
        }
      >
        <Row gutter={token.marginLG}>
          <Col lg={6} md={8} sm={12} xs={24} xxl={4} xxxl={3}>
            <Form.Item<ContentQuery> name="title">
              <Input
                allowClear
                aria-label={t("title")}
                placeholder={t("title")}
              />
            </Form.Item>
          </Col>
          <Col lg={6} md={8} sm={12} xs={24} xxl={4} xxxl={3}>
            <Form.Item<ContentQuery> name="contentCategoryId">
              <Select
                allowClear
                aria-label={t("category")}
                options={categories.map(({ id, name }) => ({
                  label: name,
                  value: id,
                }))}
                placeholder={t("category")}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      <Table<Content>
        columns={columns}
        dataSource={contents}
        loading={loading}
        pagination={{
          current,
          disabled: submitting,
          onChange: (page) => setFilters({ page: String(page) }),
          pageSize: defaultPageSize,
          showSizeChanger: false,
          total,
        }}
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
      <ContentForm
        id={selectedId}
        onFinish={fetchData}
        options={{ categories }}
      />
    </>
  );
};
