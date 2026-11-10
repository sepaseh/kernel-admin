import { act, cleanup, render, screen } from "@testing-library/react";
import type { Input } from "antd";
import { type ComponentRef, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { i18n } from "@/shared/i18n";

import { OtpInput } from "./OtpInput";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

const description = (element: HTMLElement) =>
  element
    .getAttribute("aria-describedby")
    ?.split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");

describe("OTP accessibility", () => {
  it.each([true, "true"] as const)(
    "describes required input (%s) without losing caller help",
    (required) => {
      render(
        <>
          <p id="otp-help">Use the code sent to your phone.</p>
          <OtpInput
            aria-describedby="otp-help"
            aria-invalid="true"
            aria-label="Verification code"
            aria-required={required}
          />
        </>,
      );
      const group = screen.getByRole("group", { name: "Verification code" });
      expect(description(group)).toBe(
        `Use the code sent to your phone. ${i18n.t("requiredField")}`,
      );
      expect(
        screen
          .getAllByRole("textbox")
          .every((input) => input.getAttribute("aria-invalid") === "true"),
      ).toBe(true);
      expect(group.hasAttribute("aria-required")).toBe(false);
      expect(screen.getAllByRole("textbox")).toHaveLength(6);
    },
  );

  it("keeps its description link stable when the language changes and removes it for optional input", async () => {
    const { rerender } = render(
      <OtpInput aria-label="Verification code" aria-required />,
    );
    const group = screen.getByRole("group", { name: "Verification code" });
    const id = group.getAttribute("aria-describedby");
    await act(async () => {
      await i18n.changeLanguage("fa");
    });
    expect(group.getAttribute("aria-describedby")).toBe(id);
    expect(description(group)).toBe(i18n.t("requiredField"));

    rerender(<OtpInput aria-label="Verification code" aria-required={false} />);
    expect(group.hasAttribute("aria-describedby")).toBe(false);
  });

  it("preserves controlled values and Ant Design's focus ref", () => {
    const ref = createRef<ComponentRef<typeof Input.OTP>>();
    const { rerender } = render(
      <OtpInput aria-label="Verification code" value="123456" ref={ref} />,
    );
    const inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    expect(inputs.map(({ value }) => value)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    act(() => {
      ref.current?.focus();
    });
    expect(document.activeElement).toBe(inputs[0]);
    expect(ref.current?.nativeElement).toBe(
      screen.getByRole("group", { name: "Verification code" }),
    );
    rerender(<OtpInput aria-label="Verification code" value="" ref={ref} />);
    expect(inputs.every(({ value }) => value === "")).toBe(true);
  });
});
