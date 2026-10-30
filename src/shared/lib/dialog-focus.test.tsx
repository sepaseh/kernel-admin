// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trapDialogFocus } from "./dialog-focus";

beforeEach(() => {
  // jsdom does not lay out elements; real browser coverage asserts containment.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
    function (this: HTMLElement) {
      return (this.hidden ? [] : [new DOMRect()]) as unknown as DOMRectList;
    },
  );
});

afterEach(() => vi.restoreAllMocks());

describe("dialog keyboard endpoints", () => {
  it("wraps both directions while excluding disabled, hidden and inert controls", () => {
    render(
      <div onKeyDown={trapDialogFocus}>
        <button disabled>Disabled</button>
        <button>First</button>
        <button>Middle</button>
        <button hidden>Hidden</button>
        <div inert>
          <button>Inert</button>
        </div>
        <button>Last</button>
        <button tabIndex={-1}>Not in tab order</button>
      </div>,
    );
    const first = screen.getByRole("button", { name: "First" });
    const middle = screen.getByRole("button", { name: "Middle" });
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(false);
    expect(first).toHaveFocus();
    expect(fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(
      false,
    );
    expect(last).toHaveFocus();
    middle.focus();
    expect(fireEvent.keyDown(middle, { key: "Tab" })).toBe(true);
    expect(middle).toHaveFocus();
    expect(fireEvent.keyDown(last, { ctrlKey: true, key: "Tab" })).toBe(true);
  });

  it("uses browser tab order and keeps a single available control inside", () => {
    const { rerender } = render(
      <div onKeyDown={trapDialogFocus}>
        <button>Normal</button>
        <button tabIndex={2}>Second</button>
        <button tabIndex={1}>First</button>
      </div>,
    );
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Normal" });
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();

    rerender(
      <div onKeyDown={trapDialogFocus}>
        <button>Only available control</button>
      </div>,
    );
    const only = screen.getByRole("button");
    only.focus();
    expect(fireEvent.keyDown(only, { key: "Tab" })).toBe(false);
    expect(only).toHaveFocus();
    expect(fireEvent.keyDown(only, { key: "Tab", shiftKey: true })).toBe(false);
    expect(only).toHaveFocus();
  });
});
