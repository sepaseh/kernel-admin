import { Form, Input } from "antd";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FormDrawer } from "@/shared/ui/form-drawer";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Shared/FormDrawer",
  component: FormDrawer,
  args: {
    onClose: fn(),
    onSubmit: fn(),
    open: true,
    submitting: false,
    title: "Edit record",
  },
  render: (args, { id }) => (
    <FormDrawer {...args}>
      <Form layout="vertical" name={`form-drawer-story-${id}`}>
        <Form.Item label="Name" name="name" initialValue="Example record">
          <Input />
        </Form.Item>
      </Form>
    </FormDrawer>
  ),
} satisfies Meta<typeof FormDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SubmitAndCancel: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Edit record" },
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(args.onSubmit).toHaveBeenCalledOnce();
    await userEvent.click(
      within(dialog).getByRole("button", { name: i18n.t("cancel") }),
    );
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};
export const SubmitDisabled: Story = {
  args: { submitDisabled: true },
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
    );
    await expect(
      within(dialog).getByRole("button", { name: i18n.t("submit") }),
    ).toBeDisabled();
  },
};
