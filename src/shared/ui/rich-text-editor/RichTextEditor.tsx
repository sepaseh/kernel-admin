import "quill/dist/quill.snow.css";

import { Flex } from "antd";
import { createStyles } from "antd-style";
import { type ComponentProps, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import ReactQuill from "react-quill-new";

const formats = ["header", "bold", "italic", "underline", "blockquote", "list"];
const modules = {
  toolbar: {
    container: [
      { header: [false, 2, 3] },
      "bold",
      "italic",
      "underline",
      "blockquote",
      { list: "bullet" },
      { list: "ordered" },
      "undo",
      "redo",
      "clean",
    ],
    handlers: {
      undo(this: { quill: ReturnType<ReactQuill["getEditor"]> }) {
        this.quill.history.undo();
      },
      redo(this: { quill: ReturnType<ReactQuill["getEditor"]> }) {
        this.quill.history.redo();
      },
    },
  },
  history: { delay: 500, userOnly: true },
  uploader: { mimetypes: [], handler: () => undefined },
};
const buttonLabels = {
  ".ql-bold": "editorBold",
  ".ql-italic": "editorItalic",
  ".ql-underline": "editorUnderline",
  ".ql-blockquote": "editorQuote",
  '.ql-list[value="bullet"]': "editorBulletList",
  '.ql-list[value="ordered"]': "editorOrderedList",
  ".ql-undo": "editorUndo",
  ".ql-redo": "editorRedo",
  ".ql-clean": "editorClear",
} as const;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
    color: ${token.colorText};
    .ql-toolbar.ql-snow {
      border: 0;
      border-bottom: 1px solid ${token.colorBorder};
      font-family: inherit;
      padding: ${token.paddingXS}px;
    }
    .ql-toolbar.ql-snow .ql-formats {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: ${token.marginXXS}px;
      margin: 0;
    }
    .ql-toolbar.ql-snow :is(button, select) {
      background: ${token.colorBgContainer};
      border: 1px solid ${token.colorBorder};
      border-radius: ${token.borderRadiusSM}px;
      color: ${token.colorText};
      cursor: pointer;
      font-family: inherit;
      padding: ${token.paddingXXS}px;
    }
    .ql-toolbar.ql-snow button {
      align-items: center;
      display: inline-flex;
      height: auto;
      justify-content: center;
      min-width: ${token.controlHeightSM}px;
      width: auto;
    }
    .ql-toolbar.ql-snow button svg {
      height: 16px;
      width: 16px;
    }
    .ql-toolbar.ql-snow button .ql-stroke {
      stroke: currentColor;
    }
    .ql-toolbar.ql-snow button .ql-fill {
      fill: currentColor;
    }
    .ql-toolbar.ql-snow button:is(:hover, :focus-visible, .ql-active) {
      color: ${token.colorPrimary};
    }
    .ql-toolbar.ql-snow :is(button, select):disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .ql-toolbar .ql-undo::before {
      content: "↶";
    }
    .ql-toolbar .ql-redo::before {
      content: "↷";
    }
    .ql-container.ql-snow {
      border: 0;
      font-family: inherit;
      font-size: ${token.fontSize}px;
    }
    .ql-editor {
      min-height: 320px;
      text-align: start;
    }
    .ql-editor:focus-visible {
      outline: 2px solid ${token.colorPrimary};
      outline-offset: -2px;
    }
    .ql-editor:dir(rtl) ol {
      padding-left: 0;
      padding-right: 1.5em;
    }
    .ql-editor:dir(rtl) li > .ql-ui::before {
      margin-left: 0.3em;
      margin-right: -1.5em;
      text-align: left;
    }
  `,
}));

type RichTextEditorProps = Pick<
  ComponentProps<typeof ReactQuill>,
  "id" | "onBlur" | "onChange" | "value"
> & {
  direction?: "ltr" | "rtl";
  disabled?: boolean;
};

export const RichTextEditor = ({
  direction = "ltr",
  disabled = false,
  id,
  onBlur,
  onChange,
  value = "",
}: RichTextEditorProps) => {
  const { t } = useTranslation();
  const editor = useRef<ReactQuill>(null);
  const { styles } = useStyles();

  useEffect(() => {
    const quill = editor.current?.getEditor();
    if (!quill) return;

    const { container, root } = quill;
    root.setAttribute("dir", direction);
    root.setAttribute("aria-label", t("body"));
    root.setAttribute("aria-multiline", "true");
    root.setAttribute("aria-readonly", String(disabled));
    root.setAttribute("role", "textbox");

    const toolbar = container.previousElementSibling;
    if (!toolbar?.classList.contains("ql-toolbar")) return;

    toolbar.setAttribute("aria-label", t("body"));
    toolbar.setAttribute("role", "group");
    for (const [selector, label] of Object.entries(buttonLabels)) {
      const button = toolbar.querySelector<HTMLButtonElement>(selector);
      if (button) {
        button.setAttribute("aria-label", t(label));
        button.disabled = disabled;
      }
    }

    // Snow hides the generated select behind its own picker. Keep native keyboard support.
    toolbar
      .querySelector<HTMLElement>(".ql-picker.ql-header")
      ?.style.setProperty("display", "none");
    const heading =
      toolbar.querySelector<HTMLSelectElement>("select.ql-header");
    if (heading) {
      heading.style.removeProperty("display");
      heading.setAttribute("aria-label", t("editorHeading"));
      heading.disabled = disabled;
      for (const option of heading.options) {
        const value = option.value;
        option.value = value;
        option.textContent = value ? `H${value}` : t("editorParagraph");
      }
    }
  }, [disabled, direction, t]);

  return (
    <Flex className={styles.root} vertical>
      <ReactQuill
        id={id}
        onBlur={onBlur}
        formats={formats}
        modules={modules}
        onChange={onChange}
        readOnly={disabled}
        ref={editor}
        theme="snow"
        value={value}
      />
    </Flex>
  );
};
