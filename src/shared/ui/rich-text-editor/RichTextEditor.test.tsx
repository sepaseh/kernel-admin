import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import { RichTextEditor } from "./RichTextEditor";

const ControlledEditor = () => {
  const [value, setValue] = useState("<p>Original body</p>");

  return (
    <>
      <RichTextEditor onChange={setValue} value={value} />
      <output aria-label="Saved body">{value}</output>
    </>
  );
};

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("rich text editor", () => {
  it("updates controlled content from actual editing", async () => {
    const user = userEvent.setup();
    render(<ControlledEditor />);
    const editor = screen.getByRole("textbox", { name: i18n.t("body") });

    await user.type(editor, " edited");

    await waitFor(() => expect(editor).toHaveTextContent("edited"));
    expect(editor).toHaveTextContent("Original body");
    expect(screen.getByLabelText("Saved body")).toHaveTextContent("edited");
    expect(screen.getByLabelText("Saved body")).toHaveTextContent(
      "Original body",
    );
  });

  it("updates content, direction and read-only controls when its owner changes props", async () => {
    const changed = vi.fn();
    const { rerender } = render(
      <RichTextEditor onChange={changed} value="<p>Original body</p>" />,
    );
    const editor = screen.getByRole("textbox", { name: i18n.t("body") });
    expect(editor).toHaveAttribute("dir", "ltr");
    expect(editor).toHaveAttribute("aria-readonly", "false");
    expect(editor).toHaveAttribute("contenteditable", "true");

    rerender(
      <RichTextEditor
        direction="rtl"
        disabled
        onChange={changed}
        value="<p>Updated body</p>"
      />,
    );

    expect(editor).toHaveTextContent("Updated body");
    expect(editor).toHaveAttribute("dir", "rtl");
    expect(editor).toHaveAttribute("aria-readonly", "true");
    expect(editor).toHaveAttribute("contenteditable", "false");
    expect(editor).toHaveAttribute("aria-multiline", "true");
    const toolbar = screen.getByRole("group", { name: i18n.t("body") });
    for (const button of within(toolbar).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(within(toolbar).getByRole("combobox")).toBeDisabled();

    changed.mockClear();
    await userEvent.setup().type(editor, " blocked");

    expect(editor).toHaveTextContent("Updated body");
    expect(editor).not.toHaveTextContent("blocked");
    expect(changed).not.toHaveBeenCalled();
  });

  it("uses the current language for the editable region and formatting controls", async () => {
    render(<RichTextEditor value="<p>Existing content</p>" />);

    await act(async () => {
      await i18n.changeLanguage("fa");
    });

    const editor = screen.getByRole("textbox", { name: i18n.t("body") });
    expect(editor).toHaveTextContent("Existing content");
    expect(
      screen.getByRole("button", { name: i18n.t("editorBold") }),
    ).toBeEnabled();
    expect(
      screen.getByRole("combobox", { name: i18n.t("editorHeading") }),
    ).toBeEnabled();
  });

  it("applies formatting and restores it through the toolbar's undo and redo actions", async ({
    onTestFinished,
  }) => {
    // Quill reads selection bounds when focusing; jsdom does not provide layout.
    const bounds = Object.getOwnPropertyDescriptor(
      Range.prototype,
      "getBoundingClientRect",
    );
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(),
    });
    onTestFinished(() => {
      if (bounds) {
        Object.defineProperty(Range.prototype, "getBoundingClientRect", bounds);
      } else {
        Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
      }
    });
    const user = userEvent.setup();
    render(<ControlledEditor />);
    const editor = screen.getByRole("textbox", { name: i18n.t("body") });
    await user.click(editor);
    const text = editor.querySelector("p")?.firstChild;
    const selection = window.getSelection();
    if (!(text instanceof Text) || !selection) {
      throw new Error("The editor's text selection is unavailable");
    }
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, text.length);
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent(document, new Event("selectionchange"));

    await user.click(
      screen.getByRole("button", { name: i18n.t("editorBold") }),
    );

    await waitFor(() =>
      expect(editor.querySelector("strong")).toHaveTextContent("Original body"),
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("editorUndo") }),
    );

    await waitFor(() => expect(editor.querySelector("strong")).toBeNull());
    expect(editor).toHaveTextContent("Original body");
    await user.click(
      screen.getByRole("button", { name: i18n.t("editorRedo") }),
    );

    await waitFor(() =>
      expect(editor.querySelector("strong")).toHaveTextContent("Original body"),
    );
  });

  it("loads supported formatting while turning saved links into plain text", () => {
    render(
      <RichTextEditor value='<p><a href="https://example.com/saved"><strong>Linked text</strong></a></p><ul><li>Saved item</li></ul>' />,
    );
    const editor = screen.getByRole("textbox", { name: i18n.t("body") });

    expect(editor.querySelector("strong")).toHaveTextContent("Linked text");
    expect(editor.querySelector('li[data-list="bullet"]')).toHaveTextContent(
      "Saved item",
    );
    expect(editor.querySelector("a")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /link/i }),
    ).not.toBeInTheDocument();
  });
});
