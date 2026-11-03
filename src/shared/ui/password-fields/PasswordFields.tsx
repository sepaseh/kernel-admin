import { Form, Input } from "antd";
import { useTranslation } from "react-i18next";

type PasswordFieldsProps = {
  passwordLabel?: "newPassword" | "password";
  size?: "large";
};

type PasswordFieldsValues = {
  confirmPassword: string;
  password: string;
};

export const PasswordFields = ({
  passwordLabel = "password",
  size,
}: PasswordFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item<PasswordFieldsValues>
        label={t(passwordLabel)}
        name="password"
        rules={[{ required: true }]}
      >
        <Input.Password
          placeholder={size ? t(passwordLabel) : undefined}
          size={size}
          styles={{ input: { direction: "ltr" } }}
        />
      </Form.Item>
      <Form.Item<PasswordFieldsValues>
        dependencies={["password"]}
        label={t("confirmPassword")}
        name="confirmPassword"
        rules={[
          { required: true },
          ({ getFieldValue }) => ({
            validator(_, value) {
              return !value || getFieldValue("password") === value
                ? Promise.resolve()
                : Promise.reject(new Error(t("passwordMismatch")));
            },
          }),
        ]}
      >
        <Input.Password
          placeholder={size ? t("confirmPassword") : undefined}
          size={size}
          styles={{ input: { direction: "ltr" } }}
        />
      </Form.Item>
    </>
  );
};
