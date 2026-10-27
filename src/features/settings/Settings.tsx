import type { FormProps } from "antd";
import {
  Button,
  Card,
  Col,
  ColorPicker,
  Divider,
  Flex,
  Form,
  Row,
  Select,
} from "antd";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { themeColorFields } from "@/shared/config";
import {
  isCurrentMutationError,
  useMutationRequest,
  useReadResource,
} from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { RequestFeedback } from "@/shared/ui/request-feedback";

import {
  fetchApplicationSettings,
  fetchLanguages,
  updateApplicationSettings,
} from "./api";
import { LogoUpload } from "./components/logo-upload";
import type { ApplicationSettings, ApplicationSettingsRequest } from "./types";

const loadSettings = async (signal: AbortSignal) => {
  const [settings, languages] = await Promise.all([
    fetchApplicationSettings(signal),
    fetchLanguages(signal),
  ]);
  return { settings, languages };
};

export const SettingsPage = () => {
  const { t } = useTranslation();
  const { messageAPI, modalAPI } = useAntd();
  const { acceptSettings, user } = useCore();
  const { canUpdate } = getRoutePermissions("settings", user);
  const canChangeLanguage = Boolean(user?.isSystemAdmin);
  const { cancel, run, submitting } = useMutationRequest(
    `${user?.id ?? "anonymous"}:${canChangeLanguage ? "system" : "appearance"}`,
    canUpdate,
  );
  const [form] = Form.useForm<ApplicationSettingsRequest>();
  const resource = useReadResource(loadSettings);
  const languages = resource.data?.languages ?? [];
  const settings = resource.data?.settings;
  const loading = resource.loading;

  const setFormValues = useCallback(
    (value: ApplicationSettings) => {
      form.setFieldsValue({
        darkLogoId: value.darkLogo?.id,
        darkTheme: value.darkTheme,
        languageCode: canChangeLanguage ? value.language.code : undefined,
        lightLogoId: value.lightLogo?.id,
        lightTheme: value.lightTheme,
      });
    },
    [canChangeLanguage, form],
  );

  const resetForm = () => {
    if (settings) setFormValues(settings);
  };

  const handleSubmit: FormProps<ApplicationSettingsRequest>["onFinish"] = (
    values,
  ) => {
    if (!canUpdate || submitting) return;

    const { languageCode, ...appearance } = values;
    const request = canChangeLanguage ? values : appearance;
    const languageChanged =
      canChangeLanguage && settings?.language.code !== languageCode;

    modalAPI.confirm({
      cancelText: t("no"),
      content: languageChanged ? t("languageChangeDescription") : undefined,
      okText: t("yes"),
      onCancel: cancel,
      onOk: async () => {
        try {
          const result = await run((signal) =>
            updateApplicationSettings(request, signal),
          );
          if (!result?.isCurrent()) return;
          const updatedSettings = result.data;
          resource.replace({ settings: updatedSettings, languages });
          acceptSettings(updatedSettings);
          setFormValues(updatedSettings);
          messageAPI.success(t("settingsUpdated"));
        } catch (error) {
          if (isCurrentMutationError(error))
            messageAPI.error(getErrorMessage(error.cause));
        }
      },
      title: t("settingsChangeConfirm"),
    });
  };

  useEffect(() => {
    if (settings) setFormValues(settings);
  }, [settings, setFormValues]);

  return (
    <Row>
      <Col xs={24} md={20} lg={16} xxl={12} xxxl={8}>
        <RequestFeedback
          error={resource.error}
          hasData={!!resource.data}
          loading={loading}
          retry={resource.reload}
        />
        {(!resource.error || resource.data) && (
          <Form<ApplicationSettingsRequest>
            disabled={!canUpdate || loading || submitting}
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Card loading={loading} size="small" variant="borderless">
              {canChangeLanguage && (
                <Form.Item<ApplicationSettingsRequest>
                  label={t("language")}
                  name="languageCode"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={languages.map(({ code, nativeName }) => ({
                      label: nativeName,
                      value: code,
                    }))}
                  />
                </Form.Item>
              )}
              <Row gutter={[16, 16]}>
                {(["light", "dark"] as const).map((theme) => (
                  <Col key={theme} xs={24} lg={12}>
                    <Divider
                      styles={{ content: { marginInline: 0 } }}
                      titlePlacement="start"
                    >
                      {t(theme === "light" ? "lightMode" : "darkMode")}
                    </Divider>
                    <Form.Item<ApplicationSettingsRequest>
                      label={t("logo")}
                      name={theme === "dark" ? "darkLogoId" : "lightLogoId"}
                    >
                      <LogoUpload
                        url={
                          settings?.[
                            theme === "dark" ? "darkLogo" : "lightLogo"
                          ]?.url
                        }
                      />
                    </Form.Item>
                    {themeColorFields.map((field) => (
                      <Form.Item<ApplicationSettingsRequest>
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
                        />
                      </Form.Item>
                    ))}
                  </Col>
                ))}
              </Row>
              <Flex gap={8} justify="flex-end">
                <Button onClick={resetForm}>{t("reset")}</Button>
                <Button htmlType="submit" loading={submitting} type="primary">
                  {t("submit")}
                </Button>
              </Flex>
            </Card>
          </Form>
        )}
      </Col>
    </Row>
  );
};
