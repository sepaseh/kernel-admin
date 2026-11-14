import {
  Flex,
  Progress,
  Spin,
  Typography,
  Upload,
  type UploadProps,
} from "antd";
import ImgCrop from "antd-img-crop";
import { createStyles } from "antd-style";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { UploadProgressHandler } from "@/shared/api";
import { useLock } from "@/shared/hooks";

import { readImageSize } from "./image";

const useStyles = createStyles(({ css }, aspect: number) => ({
  upload: css`
    && .ant-upload.ant-upload-select {
      aspect-ratio: ${aspect};
      height: auto;
      width: min(100%, ${104 * aspect}px);
    }
  `,
}));

type ImageUploadProps<T> = {
  disabled?: boolean;
  label: string;
  onLoadingChange?: (loading: boolean) => void;
  onChange?: (image: T) => void;
  onError: (error: Error) => void;
  settings: { height: number; size: number; width: number };
  upload: (file: File, onUploadProgress?: UploadProgressHandler) => Promise<T>;
  value?: T;
};

export const ImageUpload = <T extends { id: string; url: string }>({
  disabled = false,
  label,
  onLoadingChange,
  onChange,
  onError,
  settings,
  upload,
  value,
}: ImageUploadProps<T>) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState<number>();
  const { lock, unlock } = useLock();
  const container = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const sourceFiles = useRef(new WeakSet<File>());
  const { height, size, width } = settings;
  const { styles } = useStyles(width / height);

  const finish = () => {
    unlock();
    if (mounted.current) {
      setBusy(false);
      setPercent(undefined);
      onLoadingChange?.(false);
    }
  };

  const beforeCrop: NonNullable<UploadProps["beforeUpload"]> = async (
    selected,
  ) => {
    sourceFiles.current.add(selected);
    if (disabled || !mounted.current || !lock()) return false;

    try {
      if (!["image/jpeg", "image/png"].includes(selected.type)) {
        throw new Error(t("invalidImageType"));
      }
      if (selected.size > size) throw new Error(t("imageTooLarge"));
      setBusy(true);
      onLoadingChange?.(true);
      await readImageSize(selected);
      if (!mounted.current) {
        finish();
        return false;
      }

      return true;
    } catch (error) {
      if (mounted.current && error instanceof Error) onError(error);
      finish();
      return false;
    }
  };

  const beforeUpload: NonNullable<UploadProps["beforeUpload"]> = async (
    selected,
  ) => {
    if (sourceFiles.current.has(selected) || !mounted.current)
      return Upload.LIST_IGNORE;

    try {
      if (selected.size > size) throw new Error(t("imageTooLarge"));
      const dimensions = await readImageSize(selected);
      if (!mounted.current) return Upload.LIST_IGNORE;
      if (dimensions.width < width || dimensions.height < height) {
        throw new Error(t("imageTooSmall"));
      }
      return true;
    } catch (error) {
      if (mounted.current && error instanceof Error) onError(error);
      finish();
      return Upload.LIST_IGNORE;
    }
  };

  const handleUpload: UploadProps["customRequest"] = async ({
    file: selected,
    onSuccess,
    onProgress,
    onError: reject,
  }) => {
    try {
      if (!(selected instanceof File)) throw new Error(t("imageInvalid"));
      setPercent(0);
      const result = await upload(selected, (event) => {
        if (!mounted.current || event.progress === undefined) return;
        const progress = Math.min(
          100,
          Math.max(0, Math.round(event.progress * 100)),
        );
        setPercent(progress);
        onProgress?.({ percent: progress });
      });
      if (!mounted.current) return;

      onChange?.(result);
      onSuccess?.(result);
    } catch (error) {
      if (mounted.current && error instanceof Error) {
        onError(error);
        reject?.(error);
      }
    } finally {
      finish();
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <Flex gap={8} ref={container} vertical>
      <ImgCrop
        aspect={width / height}
        beforeCrop={beforeCrop}
        fillColor="transparent"
        modalCancel={t("cancel")}
        modalOk={t("submit")}
        modalProps={{
          getContainer: () => container.current ?? document.body,
          afterOpenChange: (open) => {
            if (!open) return;

            container.current
              ?.querySelector('[role="slider"]')
              ?.setAttribute("aria-label", t("imageZoom"));
            for (const button of container.current?.querySelectorAll<HTMLButtonElement>(
              ".img-crop-control button",
            ) ?? []) {
              button.type = "button";
            }
          },
        }}
        modalTitle={t("cropImage")}
        onModalCancel={(resolve) => {
          finish();
          resolve(Upload.LIST_IGNORE);
        }}
        quality={1}
        rotationSlider={false}
      >
        <Upload
          accept="image/jpeg,image/png"
          aria-label={label}
          beforeUpload={beforeUpload}
          className={styles.upload}
          customRequest={handleUpload}
          disabled={disabled || busy}
          listType="picture-card"
          maxCount={1}
          showUploadList={false}
        >
          {busy ? (
            <Flex align="center" gap={8} vertical>
              {percent === undefined ? (
                <Spin size="small" />
              ) : (
                <Progress percent={percent} size="small" status="active" />
              )}
              <Typography.Text>{t("loading")}</Typography.Text>
            </Flex>
          ) : value ? (
            <img
              alt={label}
              src={value.url}
              style={{ height: "100%", objectFit: "contain", width: "100%" }}
            />
          ) : (
            <Plus aria-hidden color="currentColor" size={24} />
          )}
        </Upload>
      </ImgCrop>
      <Typography.Text type="secondary">
        {t("imageTarget")}: {width} × {height}
      </Typography.Text>
    </Flex>
  );
};
