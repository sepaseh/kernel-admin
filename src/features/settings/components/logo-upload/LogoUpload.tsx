import type { UploadFile, UploadProps } from "antd";
import { Button, Upload } from "antd";
import { createStyles } from "antd-style";
import { Upload as UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { isCurrentMutationError, useMutationRequest } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";

import { uploadFile } from "./api";

const useStyles = createStyles(({ css }) => ({
  root: css`
    width: 100%;

    .ant-upload-list {
      width: 100%;
    }

    .ant-upload-select {
      width: 100% !important;

      .ant-upload {
        padding: 16px;
      }
    }
  `,
  image: css`
    width: 100%;
    height: 100%;
    object-fit: contain;
  `,
}));

type LogoUploadProps = {
  onChange?: (id?: string) => void;
  url?: string;
  value?: string;
};

export const LogoUpload = ({ onChange, url, value }: LogoUploadProps) => {
  const { t } = useTranslation();
  const { user } = useCore();
  const { canUpdate } = getRoutePermissions("settings", user);
  const { cancel, run, submitting } = useMutationRequest(
    `${user?.id ?? "anonymous"}:${value ?? ""}`,
    canUpdate,
  );
  const activeRequest = useRef<symbol | undefined>(undefined);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const previousValue = useRef<string | undefined>(undefined);
  const [uploadedFile, setUploadedFile] = useState<{
    id: string;
    url?: string;
  }>();
  const { styles } = useStyles();
  const showCompleted =
    uploadedFile && value === uploadedFile.id && url !== uploadedFile.url;
  const displayedFileList = fileList.filter(({ status }) => {
    if (submitting || status === "error") return true;
    return status === "done" && showCompleted;
  });
  const displayedUrl =
    uploadedFile && uploadedFile.id === value ? (uploadedFile.url ?? url) : url;
  const invalidateUpload = useCallback(() => {
    activeRequest.current = undefined;
    cancel();
  }, [cancel]);
  const removeUpload = () => {
    invalidateUpload();
    const restoredValue =
      uploadedFile && value === uploadedFile.id ? previousValue.current : value;
    setFileList([]);
    setUploadedFile(undefined);
    onChange?.(restoredValue);
    return true;
  };

  const handleUpload: NonNullable<UploadProps["customRequest"]> = ({
    file,
    onError,
    onSuccess,
  }) => {
    const request = Symbol();
    activeRequest.current = request;
    previousValue.current = value;
    void run((signal) => uploadFile(file as File, "public", signal))
      .then((result) => {
        if (!result?.isCurrent()) return;
        setUploadedFile(result.data);
        setFileList((files) =>
          files.map((entry) => ({
            ...entry,
            response: result.data,
            status: "done",
            url: result.data.url,
          })),
        );
        onChange?.(result.data.id);
        onSuccess?.(result.data);
      })
      .catch((error: unknown) => {
        if (activeRequest.current !== request || !isCurrentMutationError(error))
          return;
        const failure =
          error.cause instanceof Error
            ? error.cause
            : new Error(getErrorMessage(error.cause));
        setFileList((files) =>
          files.map((entry) => ({ ...entry, error: failure, status: "error" })),
        );
        onError?.(failure);
      })
      .finally(() => {
        if (activeRequest.current === request)
          activeRequest.current = undefined;
      });
    return {
      abort: () => {
        if (activeRequest.current === request) invalidateUpload();
      },
    };
  };

  useEffect(
    () => () => invalidateUpload(),
    [canUpdate, invalidateUpload, user?.id, value],
  );

  useEffect(() => {
    if (uploadedFile && value !== uploadedFile.id) {
      setFileList([]);
      setUploadedFile(undefined);
    }
  }, [uploadedFile, value]);

  return (
    <>
      <Upload
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        beforeUpload={() => {
          invalidateUpload();
          return canUpdate;
        }}
        className={styles.root}
        customRequest={handleUpload}
        disabled={canUpdate ? undefined : true}
        fileList={displayedFileList}
        listType="picture-card"
        maxCount={1}
        onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
        onRemove={removeUpload}
      >
        <Button
          aria-label={t("logo")}
          disabled={canUpdate ? undefined : true}
          htmlType="button"
          style={{ height: "100%", padding: 0, width: "100%" }}
          type="text"
        >
          {displayedUrl ? (
            <img alt={t("logo")} className={styles.image} src={displayedUrl} />
          ) : (
            <UploadIcon aria-hidden color="currentColor" size={16} />
          )}
        </Button>
      </Upload>
      {submitting && <Button onClick={removeUpload}>{t("cancel")}</Button>}
    </>
  );
};
