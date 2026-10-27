import type { Meta, StoryObj } from "@storybook/react-vite";
import { Form, Input } from "antd";
import { expect, fn, userEvent, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";

import { FormDrawer } from "./FormDrawer";

const content = (
  <Form layout="vertical">
    <Form.Item label="Name" name="name">
      <Input placeholder="Enter a name" />
    </Form.Item>
  </Form>
);

const meta = {
  args: {
    children: content,
    onClose: fn(),
    onSubmit: fn(),
    open: true,
    submitting: false,
    title: "Example form",
  },
  component: FormDrawer,
  parameters: { layout: "fullscreen" },
  title: "Shared UI/FormDrawer",
} satisfies Meta<typeof FormDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Example form" },
    );
    const drawer = within(dialog);
    await userEvent.type(
      drawer.getByRole("textbox", { name: "Name" }),
      "Operators",
    );
    const submit = drawer.getByRole("button", {
      name: i18nInstance.t("submit"),
    });
    submit.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledOnce();
    await userEvent.click(
      drawer.getByRole("button", { name: i18nInstance.t("cancel") }),
    );
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const Submitting: Story = {
  args: { submitting: true },
  play: async ({ args, canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Example form" },
    );
    const drawer = within(dialog);
    await userEvent.click(
      drawer.getByRole("button", {
        name: new RegExp(i18nInstance.t("submit")),
      }),
    );
    await userEvent.click(
      drawer.getByRole("button", {
        name: new RegExp(i18nInstance.t("cancel")),
      }),
    );
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};
