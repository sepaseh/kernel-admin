import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { RichTextEditor } from "@/shared/ui/rich-text-editor/RichTextEditor";
import { i18n } from "@/shared/i18n";

const initialContent = "Direct editor content";

const ControlledEditor = ({
  disabled = false,
  direction = "ltr",
  initialValue = `<p>${initialContent}</p>`,
}: {
  disabled?: boolean;
  direction?: "ltr" | "rtl";
  initialValue?: string;
}) => {
  const [value, setValue] = useState(initialValue);
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

export const BasicFormatting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: i18n.t("body") });
    await userEvent.pointer([
      { target: editor, offset: 0, keys: "[MouseLeft>]" },
      { target: editor, offset: initialContent.length },
      { keys: "[/MouseLeft]" },
    ]);
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("editorBold") }),
    );

    await waitFor(() =>
      expect(editor.querySelector("strong")).toHaveTextContent(initialContent),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("editorBulletList") }),
    );

    await waitFor(() =>
      expect(editor.querySelector('li[data-list="bullet"]')).toHaveTextContent(
        initialContent,
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("editorOrderedList") }),
    );

    await waitFor(() =>
      expect(editor.querySelector('li[data-list="ordered"]')).toHaveTextContent(
        initialContent,
      ),
    );
    await expect(editor.querySelector("strong")).toHaveTextContent(
      initialContent,
    );
    await expect(editor.querySelector("a")).not.toBeInTheDocument();
  },
};

export const LoadedLinksBecomeText: Story = {
  render: () => (
    <ControlledEditor initialValue='<p><a href="https://example.com/old"><strong>Linked content</strong></a></p><ul><li>First bullet</li></ul>' />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: i18n.t("body") });
    await expect(editor).toHaveTextContent("Linked content");
    await expect(editor.querySelector("strong")).toHaveTextContent(
      "Linked content",
    );
    await expect(
      editor.querySelector('li[data-list="bullet"]'),
    ).toHaveTextContent("First bullet");
    await expect(editor.querySelector("a")).not.toBeInTheDocument();
    await expect(
      canvasElement.querySelector(".ql-link"),
    ).not.toBeInTheDocument();
  },
};

export const PastedLinksBecomeText: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: i18n.t("body") });
    await userEvent.click(editor);
    await userEvent.pointer({
      target: editor,
      offset: initialContent.length,
      keys: "[MouseLeft]",
    });
    const clipboard = new DataTransfer();
    clipboard.setData(
      "text/html",
      '<p><a href="https://example.com/paste"><em>Pasted label</em></a></p><ul><li>Pasted bullet</li></ul>',
    );
    clipboard.setData("text/plain", "Pasted label\nPasted bullet");
    await userEvent.paste(clipboard);

    await waitFor(() => expect(editor).toHaveTextContent("Pasted label"));
    await expect(editor.querySelector("em")).toHaveTextContent("Pasted label");
    await expect(
      editor.querySelector('li[data-list="bullet"]'),
    ).toHaveTextContent("Pasted bullet");
    await expect(editor.querySelector("a")).not.toBeInTheDocument();

    const plainClipboard = new DataTransfer();
    plainClipboard.setData("text/plain", "https://example.com/plain");
    await userEvent.paste(plainClipboard);

    await waitFor(() =>
      expect(editor).toHaveTextContent("https://example.com/plain"),
    );
    await expect(editor.querySelector("a")).not.toBeInTheDocument();
  },
};

export const UndoRedo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", {
      name: i18n.t("body"),
    });
    await userEvent.click(editor);
    await userEvent.pointer({
      target: editor,
      offset: initialContent.length,
      keys: "[MouseLeft]",
    });
    await userEvent.type(editor, "!", { skipClick: true });
    await expect(editor.textContent).toBe(initialContent + "!");
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("editorUndo") }),
    );

    await waitFor(() => expect(editor.textContent).toBe(initialContent));
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("editorRedo") }),
    );

    await waitFor(() => expect(editor.textContent).toBe(initialContent + "!"));
  },
};
