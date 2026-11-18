// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import { FormDrawer } from "./FormDrawer";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("form drawer actions", () => {
  it("exposes named cancel and submit actions", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(
      <FormDrawer
        title="Example"
        open
        submitting={false}
        onClose={onClose}
        onSubmit={onSubmit}
      >
        Content
      </FormDrawer>,
    );
    expect(screen.getByRole("dialog", { name: "Example" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("cancel") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("prevents submission while its owner disables the action", () => {
    const onSubmit = vi.fn();
    render(
      <FormDrawer
        title="Unavailable"
        open
        submitDisabled
        submitting={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      >
        Content
      </FormDrawer>,
    );
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: i18n.t("submit"),
    });
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
