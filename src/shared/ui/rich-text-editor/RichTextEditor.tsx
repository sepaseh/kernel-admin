import "quill/dist/quill.core.css";

import { Flex, Input, Modal } from "antd";
import { createStyles } from "antd-style";
import {
  type ComponentProps,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import ReactQuill from "react-quill-new";

import { RichTextToolbar } from "./RichTextToolbar";

const formats = [
  "header",
  "bold",
  "italic",
  "underline",
  "blockquote",
  "list",
  "link",
];
const useStyles = createStyles(({ css, token }) => ({
  root: css`
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
    color: ${token.colorText};
    .ql-container {
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
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const toolbarId = `rich-text-toolbar-${useId().replaceAll(":", "")}`;
  const editor = useRef<ReactQuill>(null);
  const selection = useRef({ index: 0, length: 0 });
  const { styles } = useStyles();

  const modules = useMemo(
    () => ({
      toolbar: {
        container: `#${toolbarId}`,
        handlers: {
          undo() {
            editor.current?.getEditor().history.undo();
          },
          redo() {
            editor.current?.getEditor().history.redo();
          },
          link() {
            const instance = editor.current?.getEditor();
            const range = instance?.getSelection(true);
            if (!instance || !range || !instance.isEnabled()) return;

            selection.current = range;
            const current = instance.getFormat(range).link;
            setLink(typeof current === "string" ? current : "");
            setLinkError(false);
            setLinkOpen(true);
          },
        },
      },
      history: { delay: 500, userOnly: true },
      uploader: { mimetypes: [], handler: () => undefined },
    }),
    [toolbarId],
  );

  const applyLink = () => {
    if (disabled) return;

    try {
      const url = new URL(link);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();

      const instance = editor.current?.getEditor();
      instance?.setSelection(
        selection.current.index,
        selection.current.length,
        "silent",
      );
      if (selection.current.length === 0) {
        instance?.insertText(
          selection.current.index,
          url.href,
          "link",
          url.href,
          "user",
        );
      } else {
        instance?.formatText(
          selection.current.index,
          selection.current.length,
          "link",
          url.href,
          "user",
        );
      }
      setLinkOpen(false);
    } catch {
      setLinkError(true);
    }
  };

  useEffect(() => {
    const root = editor.current?.getEditor().root;
    root?.setAttribute("dir", direction);
    root?.setAttribute("aria-label", t("body"));
    root?.setAttribute("aria-multiline", "true");
    root?.setAttribute("aria-readonly", String(disabled));
    root?.setAttribute("role", "textbox");
  }, [disabled, direction, t]);

  return (
    <Flex className={styles.root} vertical>
      <RichTextToolbar disabled={disabled} id={toolbarId} />
      <ReactQuill
        id={id}
        onBlur={onBlur}
        formats={formats}
        modules={modules}
        onChange={onChange}
        readOnly={disabled}
        ref={editor}
        theme="default"
        value={value}
      />
      <Modal
        cancelText={t("cancel")}
        okButtonProps={{ disabled }}
        okText={t("submit")}
        onCancel={() => setLinkOpen(false)}
        onOk={applyLink}
        open={linkOpen}
        title={t("editorLink")}
      >
        <Input
          aria-label={t("editorLink")}
          disabled={disabled}
          onChange={(event) => {
            setLink(event.target.value);
            setLinkError(false);
          }}
          onPressEnter={applyLink}
          status={linkError ? "error" : undefined}
          value={link}
        />
      </Modal>
    </Flex>
  );
};
