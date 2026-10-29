import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Form } from "antd";
import type { ComponentProps } from "react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";

import { PasswordFields } from "./PasswordFields";

type PasswordFieldsStoryProps = ComponentProps<typeof PasswordFields>;

const PasswordFieldsStory = ({
  passwordLabel,
  size,
}: PasswordFieldsStoryProps) => {
  const [validated, setValidated] = useState(false);
  return (
    <Form
      layout="vertical"
      onFinish={() => setValidated(true)}
      onValuesChange={() => setValidated(false)}
      style={{ width: 320 }}
    >
      <PasswordFields passwordLabel={passwordLabel} size={size} />
      <Button htmlType="submit" type="primary">
        Validate
      </Button>
      <output aria-label="Validation result">
        {validated ? "Validated" : "Not submitted"}
      </output>
    </Form>
  );
};

const meta = {
  component: PasswordFields,
  parameters: { layout: "centered" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const password = canvas.getByLabelText(
      i18nInstance.t(args.passwordLabel ?? "password"),
      { exact: true },
    );
    const confirmation = canvas.getByLabelText(
      i18nInstance.t("confirmPassword"),
    );
    await userEvent.type(password, "synthetic-password");
    await userEvent.type(confirmation, "different-password");
    await userEvent.click(canvas.getByRole("button", { name: "Validate" }));
    await waitFor(() =>
      expect(
        canvas.getByText(i18nInstance.t("passwordMismatch")),
      ).toBeVisible(),
    );
    await userEvent.clear(confirmation);
    await userEvent.type(confirmation, "synthetic-password");
    await userEvent.click(canvas.getByRole("button", { name: "Validate" }));
    await expect(await canvas.findByText("Validated")).toBeVisible();
    // Cleared Ant Design errors remain mounted until their exit motion ends.
    await waitFor(() =>
      expect(
        canvasElement.querySelector(".ant-form-item-explain-error"),
      ).not.toBeInTheDocument(),
    );
  },
  render: (args) => <PasswordFieldsStory {...args} />,
  title: "Shared UI/PasswordFields",
} satisfies Meta<typeof PasswordFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Large: Story = { args: { size: "large" } };
export const NewPassword: Story = {
  args: { passwordLabel: "newPassword" },
};
