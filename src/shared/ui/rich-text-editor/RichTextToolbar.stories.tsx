import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { RichTextToolbar } from "@/shared/ui/rich-text-editor/RichTextToolbar";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Shared/RichTextToolbar",
  component: RichTextToolbar,
  args: { id: "toolbar-story" },
  render: (args, { id }) => (
    <RichTextToolbar {...args} id={`toolbar-story-${id}`} />
  ),
} satisfies Meta<typeof RichTextToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const toolbar = within(
      within(canvasElement).getByRole("group", { name: i18n.t("body") }),
    );
    const heading = toolbar.getByRole("combobox", {
      name: i18n.t("editorHeading"),
    });
    await userEvent.selectOptions(heading, "2");
    await expect(heading).toHaveValue("2");
    for (const key of [
      "editorBold",
      "editorItalic",
      "editorUnderline",
      "editorQuote",
      "editorBulletList",
      "editorOrderedList",
      "editorLink",
      "editorUndo",
      "editorRedo",
      "editorClear",
    ] as const)
      await expect(
        toolbar.getByRole("button", { name: i18n.t(key) }),
      ).toBeEnabled();
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("combobox")).toBeDisabled();
    for (const button of canvas.getAllByRole("button"))
      await expect(button).toBeDisabled();
  },
};
export const PersianDark: Story = {
  ...Default,
  globals: { language: "fa", theme: "dark" },
};
