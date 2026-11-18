import { Form, Input, Select } from "antd";
import { isCancel } from "axios";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { ContentCategory } from "@/features/content-categories";
import { uploadFile } from "@/features/files";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock } from "@/shared/hooks";
import { FormDrawer } from "@/shared/ui/form-drawer";
import { ImageUpload } from "@/shared/ui/image-upload";
import { RichTextEditor } from "@/shared/ui/rich-text-editor";

import { createContent, fetchContent, updateContent } from "../../api";
import type { Content, ContentRequest } from "../../types";

type ContentFormValues = Omit<ContentRequest, "coverImageId"> &
  Pick<Content, "coverImage">;

type ContentFormProps = {
  id?: Content["id"];
  onClose: () => void;
  onFinish: () => void;
  options: { categories: ContentCategory[] };
};

const initialFocusField = "title" satisfies keyof ContentRequest;

export const ContentForm = ({
  id,
  onClose,
  onFinish,
  options: { categories },
}: ContentFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ContentFormValues>();
  const [loadedId, setLoadedId] = useState<Content["id"]>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { settings } = useCore();
  const { hash } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canCreate, canUpdate } = getRoutePermissions("contents", currentUser);
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);

  const handleClose = () => {
    if (submitting || uploading) return;

    cancel();
    onClose();
  };

  const handleSubmit = async ({ coverImage, ...values }: ContentFormValues) => {
    if (
      !open ||
      loading ||
      uploading ||
      submitting ||
      (isUpdate && loadedId !== id) ||
      !lock()
    )
      return;

    const signal = start();
    setSubmitting(true);

    try {
      if (isUpdate) {
        if (id === undefined) return;

        await updateContent(
          id,
          { ...values, coverImageId: coverImage.id },
          signal,
        );
      } else {
        await createContent({ ...values, coverImageId: coverImage.id }, signal);
      }
      if (signal.aborted) return;

      void messageAPI.success(t("contentSaved"));
      onFinish();
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

  useLayoutEffect(
    () => cancel,
    [cancel, id, isCreate, isUpdate, onClose, open],
  );

  useEffect(() => {
    void (async () => {
      setLoadedId(undefined);
      setLoading(false);
      setSubmitting(false);
      unlock();

      if (!open) {
        setUploading(false);
        if (isCreate || isUpdate) onClose();

        return;
      }

      if (!isUpdate) return;

      if (id === undefined) {
        onClose();
        return;
      }

      const signal = start();
      setLoading(true);

      try {
        const data = await fetchContent(id, signal);
        if (signal.aborted) return;

        form.setFieldsValue({
          title: data.title,
          body: data.body,
          excerpt: data.excerpt,
          coverImage: data.coverImage,
          contentCategoryId: data.contentCategory.id,
        });
        setLoadedId(data.id);
      } catch (error) {
        if (signal.aborted) return;

        if (error instanceof Error) void messageAPI.error(error.message);
        onClose();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();

    return cancel;
  }, [
    cancel,
    form,
    id,
    isCreate,
    isUpdate,
    messageAPI,
    onClose,
    open,
    start,
    unlock,
  ]);

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
      size="large"
      submitDisabled={
        loading || uploading || submitting || (isUpdate && loadedId !== id)
      }
      submitting={submitting}
      title={t(isUpdate ? "update" : "create")}
    >
      <Form<ContentFormValues>
        disabled={loading || uploading || submitting}
        form={form}
        layout="vertical"
        name="content-form"
        onFinish={handleSubmit}
      >
        <Form.Item<ContentFormValues>
          label={t("title")}
          name="title"
          rules={[{ required: true, whitespace: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<ContentFormValues>
          label={t("category")}
          name="contentCategoryId"
          rules={[{ required: true }]}
        >
          <Select
            options={categories.map(({ id, name }) => ({
              label: name,
              value: id,
            }))}
          />
        </Form.Item>
        <Form.Item<ContentFormValues>
          label={t("excerpt")}
          name="excerpt"
          rules={[{ required: true, whitespace: true }]}
        >
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        {open && (
          <Form.Item<ContentFormValues>
            label={t("coverImage")}
            name="coverImage"
            preserve={false}
            rules={[{ required: true }]}
          >
            <ImageUpload
              disabled={loading || submitting}
              label={t("coverImage")}
              onLoadingChange={setUploading}
              onError={(error) => {
                void messageAPI.error(error.message);
              }}
              settings={settings.imageSettings.contents}
              upload={(file, onProgress, signal) =>
                uploadFile(file, "contents", onProgress, signal)
              }
            />
          </Form.Item>
        )}
        <Form.Item<ContentFormValues>
          label={t("body")}
          name="body"
          rules={[
            {
              required: true,
              validator: (_, value: string | undefined) => {
                const document = new DOMParser().parseFromString(
                  value ?? "",
                  "text/html",
                );
                document
                  .querySelectorAll("script, style")
                  .forEach((node) => node.remove());
                const text = document.body.textContent?.replace(
                  /[\s\u200b-\u200f\ufeff]/g,
                  "",
                );
                return text
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("bodyRequired")));
              },
            },
          ]}
        >
          <RichTextEditor
            direction={settings.language.direction}
            disabled={loading || uploading || submitting}
          />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};
