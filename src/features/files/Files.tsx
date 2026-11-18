import { Button, Table, type TableProps, Tooltip } from "antd";
import { Check, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { useAbortController, useLock } from "@/shared/hooks";

import { deleteFile, fetchFiles } from "./api";
import type { StoredFile } from "./types";

export const FilesPage = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI, modalAPI, token } = useAntd();
  const { lock, unlock } = useLock();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canDelete } = getRoutePermissions("files", currentUser);

  const fetchData = useCallback(async () => {
    const signal = start();
    setLoading(true);
    try {
      const data = await fetchFiles(signal);
      if (signal.aborted) return;

      setFiles(data);
    } catch (error) {
      if (!signal.aborted && error instanceof Error)
        void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [messageAPI, start]);

  const handleDelete = ({ id, isUsed }: StoredFile) => {
    if (!canDelete || submitting || isUsed) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okButtonProps: { danger: true },
      okText: t("yes"),
      onOk: async () => {
        if (!lock()) return;

        setSubmitting(true);
        try {
          await deleteFile(id);
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
      title: t("deleteConfirm"),
    });
  };

  const columns: TableProps<StoredFile>["columns"] = [
    {
      dataIndex: "id",
      title: t("name"),
    },
    {
      align: "center",
      dataIndex: "isUsed",
      title: t("fileUsage"),
      render: (_, { isUsed }) => (
        <Tooltip title={t(isUsed ? "fileUsed" : "fileUnused")}>
          <span
            aria-label={t(isUsed ? "fileUsed" : "fileUnused")}
            role="img"
            style={{ color: isUsed ? token.colorSuccess : token.colorError }}
          >
            {isUsed ? (
              <Check aria-hidden size="1em" />
            ) : (
              <X aria-hidden size="1em" />
            )}
          </span>
        </Tooltip>
      ),
    },
    ...(canDelete
      ? ([
          {
            align: "center",
            key: "actions",
            render: (_, record) => (
              <Tooltip title={t("delete")}>
                <Button
                  aria-label={t("delete")}
                  disabled={submitting || record.isUsed}
                  icon={<Trash2 aria-hidden color="currentColor" size="1em" />}
                  onClick={() => handleDelete(record)}
                  type="text"
                />
              </Tooltip>
            ),
            title: t("action"),
            width: 60,
          },
        ] satisfies TableProps<StoredFile>["columns"])
      : []),
  ];

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
    return cancel;
  }, [cancel, fetchData]);

  return (
    <Table<StoredFile>
      columns={columns}
      dataSource={files}
      loading={loading}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
};
