import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { RichTextEditor } from "@/shared/ui/rich-text-editor";
import { i18n } from "@/shared/i18n";

const EditorFixture = ({ disabled = false }) => {
  const [value, setValue] = useState("<p>Original body</p>");
  return (
    <RichTextEditor disabled={disabled} onChange={setValue} value={value} />
  );
};
const meta = {
  id: "shared-richtexteditor",
  title: "Shared/LazyRichTextEditor",
  component: EditorFixture,
} satisfies Meta<typeof EditorFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EditBody: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: i18n.t("body") });
    await userEvent.type(editor, "Additional text");
    await expect(editor).toHaveTextContent("Additional text");
    await expect(editor).toHaveAttribute("aria-readonly", "false");
  },
};
export const ReadOnly: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: i18n.t("body") });
    await expect(editor).toHaveAttribute("aria-readonly", "true");
    for (const button of canvas.getAllByRole("button"))
      await expect(button).toBeDisabled();
  },
};
