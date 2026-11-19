import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import { RichTextToolbar } from "./RichTextToolbar";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("rich text toolbar", () => {
  it("keeps formatting actions from submitting its containing form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn<NonNullable<ComponentProps<"form">["onSubmit"]>>(
      (event) => event.preventDefault(),
    );
    render(
      <form onSubmit={submit}>
        <RichTextToolbar id="article-formatting" />
      </form>,
    );
    const toolbar = screen.getByRole("group", { name: i18n.t("body") });

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
      const button = within(toolbar).getByRole("button", {
        name: i18n.t(label),
      });
      await user.click(button);
    }

    expect(submit).not.toHaveBeenCalled();
  });

  it("preserves the chosen heading while controls are disabled and re-enabled", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RichTextToolbar id="article-formatting" />);
    const heading = screen.getByRole("combobox", {
      name: i18n.t("editorHeading"),
    });
    await user.selectOptions(heading, "2");
    expect(heading).toHaveValue("2");

    rerender(<RichTextToolbar disabled id="article-formatting" />);

    expect(heading).toBeDisabled();
    await user.selectOptions(heading, "3");
    expect(heading).toHaveValue("2");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }

    rerender(<RichTextToolbar id="article-formatting" />);
    await user.selectOptions(heading, "3");

    expect(heading).toBeEnabled();
    expect(heading).toHaveValue("3");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeEnabled();
    }
  });
});
