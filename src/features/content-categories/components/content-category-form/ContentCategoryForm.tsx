import { Form, type FormProps, Input } from "antd";
import { isCancel } from "axios";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useGoBack, useLock } from "@/shared/hooks";
import { FormDrawer } from "@/shared/ui/form-drawer";

import {
  createContentCategory,
  fetchContentCategory,
  updateContentCategory,
} from "../../api";
import type { ContentCategory, ContentCategoryRequest } from "../../types";

type ContentCategoryFormProps = {
  id?: ContentCategory["id"];
  onFinish: () => void;
};

const initialFocusField = "name" satisfies keyof ContentCategoryRequest;

export const ContentCategoryForm = ({
  id,
  onFinish,
}: ContentCategoryFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ContentCategoryRequest>();
  const [loadedId, setLoadedId] = useState<ContentCategory["id"]>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const goBack = useGoBack();
  const { hash } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canCreate, canUpdate } = getRoutePermissions(
    "contentCategories",
    currentUser,
  );
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);

  const handleClose = () => {
    cancel();
    goBack();
  };

  const handleSubmit: FormProps<ContentCategoryRequest>["onFinish"] = async (
    values,
  ) => {
    if (
      !open ||
      loading ||
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

        await updateContentCategory(id, values, signal);
      } else {
        await createContentCategory(values, signal);
      }
      if (signal.aborted) return;

      void messageAPI.success(t("contentSaved"));
      void onFinish();
      handleClose();
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

  useLayoutEffect(() => cancel, [cancel, goBack, id, isCreate, isUpdate, open]);

  useEffect(() => {
    void (async () => {
      setLoadedId(undefined);
      setLoading(false);
      setSubmitting(false);
      unlock();

      if (!open) {
        if (isCreate || isUpdate) goBack();

        return;
      }

      if (!isUpdate) return;

      if (id === undefined) {
        goBack();
        return;
      }

      const signal = start();
      setLoading(true);

      try {
        const data = await fetchContentCategory(id, signal);
        if (signal.aborted) return;

        form.setFieldsValue({ name: data.name });
        setLoadedId(data.id);
      } catch (error) {
        if (signal.aborted) return;

        if (error instanceof Error) void messageAPI.error(error.message);
        goBack();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();

    return cancel;
  }, [
    cancel,
    form,
    goBack,
    id,
    isCreate,
    isUpdate,
    messageAPI,
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
      submitDisabled={loading || submitting || (isUpdate && loadedId !== id)}
      submitting={submitting}
      title={t(isUpdate ? "update" : "create")}
    >
      <Form<ContentCategoryRequest>
        disabled={loading || submitting}
        form={form}
        layout="vertical"
        name="content-category-form"
        onFinish={handleSubmit}
      >
        <Form.Item<ContentCategoryRequest>
          label={t("name")}
          name="name"
          rules={[{ required: true, whitespace: true }]}
        >
          <Input />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};
