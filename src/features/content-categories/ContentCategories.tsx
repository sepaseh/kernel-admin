import { Button, Flex, FloatButton, type TableProps, Tooltip } from "antd";
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
import { SortableTable } from "@/shared/ui/sortable-table";

import {
  deleteContentCategory,
  fetchContentCategories,
  sortContentCategories,
} from "./api";
import { ContentCategoryForm } from "./components/content-category-form/ContentCategoryForm";
import type { ContentCategory } from "./types";

export const ContentCategoriesPage = () => {
  const { t } = useTranslation();
  const [contentCategories, setContentCategories] = useState<ContentCategory[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<ContentCategory["id"]>();
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI, modalAPI } = useAntd();
  const { pathname, search } = useLocation();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "contentCategories",
    currentUser,
  );

  const fetchData = useCallback(async () => {
    const signal = start();
    setLoading(true);

    try {
      const data = await fetchContentCategories(signal);
      if (signal.aborted) return;

      setContentCategories(data);
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [messageAPI, start]);

  const handleDelete = (id: ContentCategory["id"]) => {
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
          await deleteContentCategory(id);
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

  const handleUpdate = (id: ContentCategory["id"]) => {
    if (!canUpdate || submitting) return;

    setSelectedId(id);
    void navigate(
      { hash: modalKeys.update, pathname, search },
      { state: true },
    );
  };

  const handleOrder = async (items: ContentCategory[]) => {
    if (!canUpdate || loading || submitting || !lock()) return;

    setSubmitting(true);

    try {
      await sortContentCategories({ ids: items.map((item) => item.id) });
      void messageAPI.success(t("contentSaved"));
      await fetchData();
    } catch (error) {
      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      setSubmitting(false);
      unlock();
    }
  };

  const columns: TableProps<ContentCategory>["columns"] = [
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
        ] satisfies TableProps<ContentCategory>["columns"])
      : []),
  ];

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
    return cancel;
  }, [cancel, fetchData]);

  return (
    <>
      <SortableTable<ContentCategory>
        columns={columns}
        data={contentCategories}
        sortable={canUpdate}
        disabled={loading || submitting}
        dragLabel={t("order")}
        onReorder={handleOrder}
        loading={loading}
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
      <ContentCategoryForm id={selectedId} onFinish={fetchData} />
    </>
  );
};
