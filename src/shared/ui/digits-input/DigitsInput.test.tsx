import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ChangeEvent, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DigitsInput } from "./DigitsInput";

afterEach(cleanup);

describe("numeric text input", () => {
  it("normalizes uncontrolled default and replacement values", () => {
    render(<DigitsInput aria-label="Mobile" defaultValue="1x2" />);
    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Mobile",
    });
    expect(input.value).toBe("12");
    fireEvent.change(input, { target: { value: "a3 b4" } });
    expect(input.value).toBe("34");
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
  });

  it("preserves real input metadata and normalized event values for controlled forms", () => {
    const onChange = vi.fn((event: ChangeEvent<HTMLInputElement>) => ({
      target: event.target.value,
      currentTarget: event.currentTarget.value,
      name: event.target.name,
      isInput: event.target instanceof HTMLInputElement,
    }));
    const Consumer = () => {
      const [value, setValue] = useState("1");
      return (
        <DigitsInput
          aria-label="Mobile"
          name="mobile"
          value={value}
          onChange={(event) => {
            onChange(event);
            setValue(event.target.value);
          }}
        />
      );
    };
    render(<Consumer />);
    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Mobile",
    });

    fireEvent.change(input, { target: { value: "1x2" } });

    expect(input.value).toBe("12");
    expect(onChange).toHaveLastReturnedWith({
      target: "12",
      currentTarget: "12",
      name: "mobile",
      isInput: true,
    });
  });
});
