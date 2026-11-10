import {
  Bold,
  Eraser,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { createStyles } from "antd-style";

const useStyles = createStyles(({ css, token }) => ({
  toolbar: css`
    border-bottom: 1px solid ${token.colorBorder};
    display: flex;
    flex-wrap: wrap;
    gap: ${token.marginXXS}px;
    padding: ${token.paddingXS}px;
    button,
    select {
      background: ${token.colorBgContainer};
      border: 1px solid ${token.colorBorder};
      border-radius: ${token.borderRadiusSM}px;
      color: ${token.colorText};
      cursor: pointer;
      padding: ${token.paddingXXS}px;
    }
    button.ql-active {
      color: ${token.colorPrimary};
    }
    button:disabled,
    select:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `,
}));

type RichTextToolbarProps = { disabled?: boolean; id: string };

export const RichTextToolbar = ({
  disabled = false,
  id,
}: RichTextToolbarProps) => {
  const { t } = useTranslation();
  const { styles } = useStyles();

  return (
    <div aria-label={t("body")} className={styles.toolbar} id={id} role="group">
      <select
        aria-label={t("editorHeading")}
        className="ql-header"
        defaultValue=""
        disabled={disabled}
      >
        <option value="">{t("editorParagraph")}</option>
        <option value="2">H2</option>
        <option value="3">H3</option>
      </select>
      <button
        aria-label={t("editorBold")}
        className="ql-bold"
        disabled={disabled}
        type="button"
      >
        <Bold aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorItalic")}
        className="ql-italic"
        disabled={disabled}
        type="button"
      >
        <Italic aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorUnderline")}
        className="ql-underline"
        disabled={disabled}
        type="button"
      >
        <Underline aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorQuote")}
        className="ql-blockquote"
        disabled={disabled}
        type="button"
      >
        <Quote aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorBulletList")}
        className="ql-list"
        disabled={disabled}
        type="button"
        value="bullet"
      >
        <List aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorOrderedList")}
        className="ql-list"
        disabled={disabled}
        type="button"
        value="ordered"
      >
        <ListOrdered aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorLink")}
        className="ql-link"
        disabled={disabled}
        type="button"
      >
        <Link aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorUndo")}
        className="ql-undo"
        disabled={disabled}
        type="button"
      >
        <Undo2 aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorRedo")}
        className="ql-redo"
        disabled={disabled}
        type="button"
      >
        <Redo2 aria-hidden size={16} />
      </button>
      <button
        aria-label={t("editorClear")}
        className="ql-clean"
        disabled={disabled}
        type="button"
      >
        <Eraser aria-hidden size={16} />
      </button>
    </div>
  );
};
