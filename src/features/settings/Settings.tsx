import {
  Button,
  Card,
  Col,
  ColorPicker,
  Divider,
  Flex,
  Form,
  type FormProps,
  InputNumber,
  Row,
  Select,
} from "antd";
import { isCancel } from "axios";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { uploadFile } from "@/features/files";
import type { DefaultLayoutContext } from "@/layouts/default";
import { themeColorFields } from "@/shared/contracts";
import { useAbortController, useLock } from "@/shared/hooks";
import { ImageUpload } from "@/shared/ui/image-upload";

import { fetchLanguages, updateSettings } from "./api";
import type { Settings, SettingsRequest } from "./types";

type SettingsFormValues = Omit<SettingsRequest, "darkLogoId" | "lightLogoId"> &
  Pick<Settings, "darkLogo" | "lightLogo">;

export const SettingsPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<SettingsFormValues>();
  const [languages, setLanguages] = useState<Settings["language"][]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI, token } = useAntd();
  const { settings, setSettings } = useCore();
  const { lock, unlock } = useLock();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canUpdate } = getRoutePermissions("settings", currentUser);
  const isSystemAdmin = currentUser.isSystemAdmin;

  const setFormValues = useCallback(
    (value: Settings) => {
      form.setFieldsValue({
        darkLogo: value.darkLogo,
        darkTheme: { ...value.darkTheme },
        imageSettings: {
          contents: { ...value.imageSettings.contents },
          logo: { ...value.imageSettings.logo },
        },
        languageCode: value.language.code,
        lightLogo: value.lightLogo,
        lightTheme: { ...value.lightTheme },
      });
    },
    [form],
  );

  const resetFormValues = () => {
    setFormValues(settings);
  };

  const handleSubmit: FormProps<SettingsFormValues>["onFinish"] = async ({
    darkLogo,
    languageCode,
    lightLogo,
    ...values
  }) => {
    if (!canUpdate || !lock()) return;

    const signal = start();
    setSubmitting(true);
    try {
      const value = await updateSettings(
        {
          ...values,
          ...(isSystemAdmin ? { languageCode } : {}),
          darkLogoId: darkLogo?.id,
          lightLogoId: lightLogo?.id,
        },
        signal,
      );
      if (signal.aborted) return;

      setSettings(value);
      void messageAPI.success(t("settingsUpdated"));
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) {
        setSubmitting(false);
        unlock();
      }
    }
  };

  useLayoutEffect(
    () => cancel,
    [cancel, canUpdate, currentUser.id, isSystemAdmin],
  );

  useEffect(() => {
    setSubmitting(false);
    unlock();
  }, [canUpdate, currentUser.id, isSystemAdmin, unlock]);

  useEffect(() => {
    setFormValues(settings);
  }, [settings, setFormValues]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const options = await fetchLanguages(controller.signal);
        if (!controller.signal.aborted) setLanguages(options);
      } catch (error) {
        if (!controller.signal.aborted && error instanceof Error)
          void messageAPI.error(error.message);
      }
    })();

    return () => controller.abort();
  }, [messageAPI]);

  return (
    <Row>
      <Col lg={16} md={20} xs={24} xxl={12}>
        <Form<SettingsFormValues>
          disabled={!canUpdate || submitting}
          form={form}
          layout="vertical"
          name="settings-form"
          onFinish={handleSubmit}
        >
          <Card size="small" variant="borderless">
            <Form.Item<SettingsFormValues>
              label={t("language")}
              name="languageCode"
              rules={[{ required: true }]}
            >
              <Select
                disabled={!isSystemAdmin || !canUpdate || submitting}
                options={languages.map(({ code, nativeName }) => ({
                  label: nativeName,
                  value: code,
                }))}
              />
            </Form.Item>
            <Row gutter={[16, 16]}>
              {(["light", "dark"] as const).map((theme) => (
                <Col key={theme} lg={12} xs={24}>
                  <Divider
                    styles={{ content: { marginInline: 0 } }}
                    titlePlacement="start"
                  >
                    {t(theme === "light" ? "lightMode" : "darkMode")}
                  </Divider>
                  <Form.Item<SettingsFormValues>
                    label={t("logo")}
                    name={theme === "dark" ? "darkLogo" : "lightLogo"}
                  >
                    <ImageUpload
                      disabled={submitting || !canUpdate}
                      label={t("logo")}
                      onError={(error) => {
                        void messageAPI.error(error.message);
                      }}
                      settings={settings.imageSettings.logo}
                      upload={(file, onProgress) =>
                        uploadFile(file, "logo", onProgress)
                      }
                    />
                  </Form.Item>
                  {themeColorFields.map((field) => (
                    <Form.Item<SettingsFormValues>
                      getValueFromEvent={(color) => color.toHexString()}
                      key={field}
                      label={t(field)}
                      name={[
                        theme === "dark" ? "darkTheme" : "lightTheme",
                        field,
                      ]}
                    >
                      <ColorPicker
                        format="hex"
                        showText
                        style={{ width: "100%" }}
                        styles={{ description: { color: token.colorText } }}
                      />
                    </Form.Item>
                  ))}
                </Col>
              ))}
            </Row>
            {(["contents", "logo"] as const).map((context) => (
              <div key={context}>
                <Divider titlePlacement="start">
                  {t(context === "logo" ? "logo" : "contents")}
                </Divider>
                <Row gutter={16}>
                  {(
                    [
                      ["width", "imageWidth"],
                      ["height", "imageHeight"],
                      ["size", "imageMaxBytes"],
                    ] as const
                  ).map(([field, labelKey]) => (
                    <Col key={field} md={8} xs={24}>
                      <Form.Item<SettingsFormValues>
                        label={t(labelKey)}
                        name={["imageSettings", context, field]}
                        rules={[
                          {
                            max:
                              field === "size" ? Number.MAX_SAFE_INTEGER : 8192,
                            min: 1,
                            required: true,
                            type: "integer",
                          },
                        ]}
                      >
                        <InputNumber
                          max={
                            field === "size" ? Number.MAX_SAFE_INTEGER : 8192
                          }
                          min={1}
                          precision={0}
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              </div>
            ))}
            <Flex gap={8} justify="flex-end">
              <Button disabled={submitting} onClick={resetFormValues}>
                {t("reset")}
              </Button>
              <Button
                disabled={!canUpdate || submitting}
                htmlType="submit"
                loading={submitting}
                type="primary"
              >
                {t("submit")}
              </Button>
            </Flex>
          </Card>
        </Form>
      </Col>
    </Row>
  );
};
