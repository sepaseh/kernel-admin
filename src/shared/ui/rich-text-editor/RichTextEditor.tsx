import "quill/dist/quill.core.css";

import { Flex } from "antd";
import { createStyles } from "antd-style";
import { type ComponentProps, useEffect, useId, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import ReactQuill from "react-quill-new";

import { RichTextToolbar } from "./RichTextToolbar";

const formats = ["header", "bold", "italic", "underline", "blockquote", "list"];
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
  const toolbarId = `rich-text-toolbar-${useId().replaceAll(":", "")}`;
  const editor = useRef<ReactQuill>(null);
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
        },
      },
      history: { delay: 500, userOnly: true },
      uploader: { mimetypes: [], handler: () => undefined },
    }),
    [toolbarId],
  );

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
    </Flex>
  );
};
