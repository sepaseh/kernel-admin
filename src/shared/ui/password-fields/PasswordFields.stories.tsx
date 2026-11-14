import { Button, Form } from "antd";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { PasswordFields } from "@/shared/ui/password-fields";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Shared/PasswordFields",
  args: { onFinish: fn() },
  render: ({ onFinish }, { id }) => (
    <Form
      layout="vertical"
      name={`password-fields-story-${id}`}
      onFinish={onFinish}
    >
      <PasswordFields />
      <Button htmlType="submit">Save password</Button>
    </Form>
  ),
} satisfies Meta<{ onFinish: (values: unknown) => void }>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MismatchThenCorrect: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText(i18n.t("password"), { exact: true }),
      "Synthetic-password!",
    );
    const confirmation = canvas.getByLabelText(i18n.t("confirmPassword"), {
      exact: true,
    });
    await userEvent.type(confirmation, "Different-password!");
    await userEvent.click(
      canvas.getByRole("button", { name: "Save password" }),
    );
    await expect(
      await canvas.findByText(i18n.t("passwordMismatch")),
    ).toBeVisible();
    await expect(args.onFinish).not.toHaveBeenCalled();
    await userEvent.clear(confirmation);
    await userEvent.type(confirmation, "Synthetic-password!");
    await userEvent.click(
      canvas.getByRole("button", { name: "Save password" }),
    );
    await expect(args.onFinish).toHaveBeenCalledWith({
      password: "Synthetic-password!",
      confirmPassword: "Synthetic-password!",
    });
    await waitFor(() =>
      expect(
        canvas.queryByText(i18n.t("passwordMismatch")),
      ).not.toBeInTheDocument(),
    );
  },
};
