// @vitest-environment jsdom
import { type ChangeEvent, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render";

import { DigitsInput } from "./";

const DigitsInputHarness = () => {
  const [value, setValue] = useState("");

  return (
    <DigitsInput
      aria-label="Mobile"
      onChange={(event) => setValue(event.target.value)}
      value={value}
    />
  );
};

describe("DigitsInput", () => {
  it("keeps only numeric characters while typing", async () => {
    const { user } = render(<DigitsInputHarness />);

    await user.type(screen.getByRole("textbox", { name: "Mobile" }), "a1 b2");

    expect(screen.getByRole("textbox", { name: "Mobile" })).toHaveValue("12");
  });

  it("keeps uncontrolled default, pasted and cleared values in sync with real input events", async () => {
    const onChange = vi.fn((event: ChangeEvent<HTMLInputElement>) => ({
      currentTargetValue: event.currentTarget?.value,
      id: event.target.id,
      isInput: event.target instanceof HTMLInputElement,
      name: event.target.name,
      preventDefault: typeof event.preventDefault,
      value: event.target.value,
    }));
    const { user } = render(
      <DigitsInput
        allowClear={{ clearIcon: "Clear" }}
        aria-label="Mobile"
        defaultValue="1x2"
        id="mobile-field"
        name="mobile"
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Mobile" });
    expect(input).toHaveValue("12");

    await user.click(input);
    await user.paste("a3 b4");
    expect(input).toHaveValue("1234");
    expect(onChange).toHaveLastReturnedWith({
      currentTargetValue: "1234",
      id: "mobile-field",
      isInput: true,
      name: "mobile",
      preventDefault: "function",
      value: "1234",
    });

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(input).toHaveValue("");
    expect(onChange).toHaveLastReturnedWith(
      expect.objectContaining({ currentTargetValue: "", value: "" }),
    );
    await user.type(input, "c5");
    expect(input).toHaveValue("5");
    await user.clear(input);
    expect(input).toHaveValue("");
  });

  it("filters uncontrolled typing without requiring a change handler", async () => {
    const { user } = render(<DigitsInput aria-label="Mobile" />);
    const input = screen.getByRole("textbox", { name: "Mobile" });
    await user.type(input, "a1 b2");
    expect(input).toHaveValue("12");
  });

  it("preserves currentTarget and input metadata for controlled consumers", async () => {
    const onChange = vi.fn((event: ChangeEvent<HTMLInputElement>) => ({
      currentTargetValue: event.currentTarget?.value,
      name: event.target.name,
      value: event.target.value,
    }));
    const { user } = render(
      <DigitsInput
        aria-label="Mobile"
        name="mobile"
        onChange={onChange}
        value="1"
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "Mobile" }), "2");
    expect(onChange).toHaveLastReturnedWith({
      currentTargetValue: "12",
      name: "mobile",
      value: "12",
    });
  });
});
