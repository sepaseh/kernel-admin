import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { RichTextEditor } from "@/shared/ui/rich-text-editor/RichTextEditor";
import { i18n } from "@/shared/i18n";

const ControlledEditor = ({
  disabled = false,
  direction = "ltr",
}: {
  disabled?: boolean;
  direction?: "ltr" | "rtl";
}) => {
  const [value, setValue] = useState("<p>Direct editor content</p>");
  return (
    <RichTextEditor
      disabled={disabled}
      direction={direction}
      onChange={setValue}
      value={value}
    />
  );
};
const meta = {
  id: "shared-richtexteditor-direct",
  title: "Shared/RichTextEditor",
  component: RichTextEditor,
  render: (args) => (
    <ControlledEditor disabled={args.disabled} direction={args.direction} />
  ),
} satisfies Meta<typeof RichTextEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EditBody: Story = {
  play: async ({ canvasElement }) => {
    const editor = await within(canvasElement).findByRole("textbox", {
      name: i18n.t("body"),
    });
    await userEvent.type(editor, " Edited in isolation");
    await expect(editor).toHaveTextContent("Edited in isolation");
    await expect(editor).toHaveAttribute("aria-readonly", "false");
  },
};
export const ReadOnly: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const editor = await within(canvasElement).findByRole("textbox", {
      name: i18n.t("body"),
    });
    await expect(editor).toHaveAttribute("aria-readonly", "true");
    await expect(editor).toHaveTextContent("Direct editor content");
  },
};
export const PersianDark: Story = {
  args: { direction: "rtl" },
  globals: { language: "fa", theme: "dark" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("textbox", {
        name: i18n.t("body"),
      }),
    ).toHaveAttribute("dir", "rtl");
  },
};
