import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import { RichTextEditor } from "./LazyRichTextEditor";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

it("shows loading until the real editor is ready and forwards its live props", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  const { container, rerender } = render(
    <RichTextEditor
      direction="rtl"
      disabled
      id="synthetic-lazy-editor"
      onChange={onChange}
      value="<p>Original body</p>"
    />,
  );

  expect(container.querySelector(".ant-spin-spinning")).toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: i18n.t("body") }),
  ).not.toBeInTheDocument();

  await act(async () => {
    await import("./RichTextEditor");
  });
  const editor = await screen.findByRole("textbox", { name: i18n.t("body") });

  expect(container.querySelector(".ant-spin-spinning")).not.toBeInTheDocument();
  expect(editor).toHaveTextContent("Original body");
  expect(editor).toHaveAttribute("dir", "rtl");
  expect(editor).toHaveAttribute("aria-readonly", "true");
  expect(editor).toHaveAttribute("contenteditable", "false");
  expect(document.getElementById("synthetic-lazy-editor")).toContainElement(
    editor,
  );
  for (const button of within(container).getAllByRole("button"))
    expect(button).toBeDisabled();

  rerender(
    <RichTextEditor
      direction="ltr"
      id="synthetic-lazy-editor"
      onChange={onChange}
      value="<p>Updated body</p>"
    />,
  );

  expect(editor).toHaveTextContent("Updated body");
  expect(editor).toHaveAttribute("dir", "ltr");
  expect(editor).toHaveAttribute("aria-readonly", "false");
  expect(editor).toHaveAttribute("contenteditable", "true");
  for (const button of within(container).getAllByRole("button"))
    expect(button).toBeEnabled();

  await user.type(editor, " edited");

  expect(onChange).toHaveBeenLastCalledWith(
    expect.stringContaining("edited"),
    expect.anything(),
    "user",
    expect.anything(),
  );
});
