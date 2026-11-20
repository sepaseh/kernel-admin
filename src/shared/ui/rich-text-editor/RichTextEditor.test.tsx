import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import { RichTextEditor } from "./RichTextEditor";

const ControlledEditor = ({ disabled = false }: { disabled?: boolean }) => {
  const [value, setValue] = useState("<p>Original body</p>");

  return (
    <>
      <RichTextEditor disabled={disabled} onChange={setValue} value={value} />
      <output aria-label="Saved body">{value}</output>
    </>
  );
};

beforeEach(async ({ onTestFinished }) => {
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

  it("keeps generated toolbar controls scoped to their own editor", () => {
    render(
      <>
        <section aria-label="Read-only editor">
          <RichTextEditor direction="rtl" disabled value="<p>Read-only</p>" />
        </section>
        <section aria-label="Editable editor">
          <RichTextEditor value="<p>Editable</p>" />
        </section>
      </>,
    );

    const readOnly = within(
      screen.getByRole("region", { name: "Read-only editor" }),
    );
    const editable = within(
      screen.getByRole("region", { name: "Editable editor" }),
    );
    const readOnlyBody = readOnly.getByRole("textbox", {
      name: i18n.t("body"),
    });
    const editableBody = editable.getByRole("textbox", {
      name: i18n.t("body"),
    });
    const readOnlyToolbar = within(
      readOnly.getByRole("group", { name: i18n.t("body") }),
    );
    const editableToolbar = within(
      editable.getByRole("group", { name: i18n.t("body") }),
    );

    expect(readOnlyBody).toHaveAttribute("dir", "rtl");
    expect(readOnlyBody).toHaveAttribute("aria-readonly", "true");
    expect(editableBody).toHaveAttribute("dir", "ltr");
    expect(editableBody).toHaveAttribute("aria-readonly", "false");
    expect(
      readOnlyToolbar.getByRole("button", { name: i18n.t("editorBold") }),
    ).toBeDisabled();
    expect(
      editableToolbar.getByRole("button", { name: i18n.t("editorBold") }),
    ).toBeEnabled();
    expect(
      readOnlyToolbar.getByRole("combobox", { name: i18n.t("editorHeading") }),
    ).toBeDisabled();
    expect(
      editableToolbar.getByRole("combobox", { name: i18n.t("editorHeading") }),
    ).toBeEnabled();
  });

  it("keeps formatting actions from submitting its containing form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn<NonNullable<ComponentProps<"form">["onSubmit"]>>(
      (event) => event.preventDefault(),
    );
    render(
      <form onSubmit={submit}>
        <ControlledEditor />
      </form>,
    );
    const toolbar = within(screen.getByRole("group", { name: i18n.t("body") }));

    for (const label of [
      "editorBold",
      "editorItalic",
      "editorUnderline",
      "editorQuote",
      "editorBulletList",
      "editorOrderedList",
      "editorUndo",
      "editorRedo",
      "editorClear",
    ] as const) {
      const button = toolbar.getByRole("button", { name: i18n.t(label) });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("type", "button");
      await user.click(button);
    }

    expect(submit).not.toHaveBeenCalled();
  });

  it("preserves the chosen heading while controls are disabled and re-enabled", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ControlledEditor />);
    const editor = screen.getByRole("textbox", { name: i18n.t("body") });
    const toolbar = within(screen.getByRole("group", { name: i18n.t("body") }));
    const heading = toolbar.getByRole("combobox", {
      name: i18n.t("editorHeading"),
    });

    await user.click(editor);
    await user.selectOptions(heading, "2");
    await waitFor(() =>
      expect(editor.querySelector("h2")).toHaveTextContent("Original body"),
    );
    expect(heading).toHaveValue("2");

    rerender(<ControlledEditor disabled />);

    expect(heading).toBeDisabled();
    await user.selectOptions(heading, "3");
    expect(heading).toHaveValue("2");
    expect(editor.querySelector("h2")).toHaveTextContent("Original body");
    for (const button of toolbar.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }

    rerender(<ControlledEditor />);
    await user.click(editor);
    await user.selectOptions(heading, "3");

    expect(heading).toBeEnabled();
    expect(heading).toHaveValue("3");
    await waitFor(() =>
      expect(editor.querySelector("h3")).toHaveTextContent("Original body"),
    );
    for (const button of toolbar.getAllByRole("button")) {
      expect(button).toBeEnabled();
    }
  });

  it("applies formatting and restores it through the toolbar's undo and redo actions", async () => {
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
