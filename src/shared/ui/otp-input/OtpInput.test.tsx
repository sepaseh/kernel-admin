// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { Input } from "antd";
import type { ComponentRef } from "react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18nInstance } from "@/shared/i18n/index.ts";
import { render, screen } from "@/test/render.tsx";

import { OtpInput } from "./";

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
});

describe("OtpInput", () => {
  it("does not forward aria-required to the OTP group", () => {
    const { container } = render(
      <OtpInput aria-required length={4} size="large" />,
    );

    expect(container.querySelectorAll("input")).toHaveLength(4);
    expect(container.querySelector("[aria-required]")).not.toBeInTheDocument();
  });

  it.each([true, "true"] as const)(
    "describes a required OTP (%s) without losing caller descriptions",
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
      expect(group).toHaveAccessibleDescription(
        "Use the code sent to your phone. Required field",
      );
      expect(group).toHaveAttribute("aria-invalid", "true");
      expect(group).not.toHaveAttribute("aria-required");
      expect(screen.getAllByRole("textbox")).toHaveLength(6);
    },
  );

  it.each([undefined, false, "false"] as const)(
    "keeps an optional OTP (%s) optional",
    (required) => {
      render(
        <>
          <p id="otp-help">Use the code sent to your phone.</p>
          <OtpInput
            aria-describedby="otp-help"
            aria-label="Verification code"
            aria-required={required}
          />
        </>,
      );

      const group = screen.getByRole("group", { name: "Verification code" });
      expect(group).toHaveAccessibleDescription(
        "Use the code sent to your phone.",
      );
      expect(group).toHaveAttribute("aria-describedby", "otp-help");
      expect(group).not.toHaveAttribute("aria-required");
      expect(screen.queryByText("Required field")).not.toBeInTheDocument();
    },
  );

  it("keeps a stable description link and updates localized required text", async () => {
    const { rerender } = render(
      <OtpInput aria-label="Verification code" aria-required />,
    );
    const group = screen.getByRole("group", { name: "Verification code" });
    const descriptionId = group.getAttribute("aria-describedby");

    await act(async () => {
      await i18nInstance.changeLanguage("fa");
    });
    expect(group).toHaveAccessibleDescription(i18nInstance.t("requiredField"));
    expect(group).toHaveAttribute("aria-describedby", descriptionId);

    rerender(<OtpInput aria-label="Verification code" aria-required={false} />);
    expect(group).not.toHaveAttribute("aria-describedby");
    expect(group).not.toHaveAccessibleDescription();
    rerender(<OtpInput aria-label="Verification code" aria-required />);
    expect(group).toHaveAttribute("aria-describedby", descriptionId);
    expect(group).toHaveAccessibleDescription(i18nInstance.t("requiredField"));
  });

  it("preserves uncontrolled six-digit entry and completion callbacks", async () => {
    const onChange = vi.fn();
    const { user } = render(
      <OtpInput
        aria-label="Verification code"
        defaultValue="12"
        onChange={onChange}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[2], "3456");

    expect(inputs).toHaveLength(6);
    for (const [index, input] of inputs.entries())
      expect(input).toHaveValue(String(index + 1));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("123456");
  });

  it("preserves controlled values and the Ant Design focus ref", () => {
    const ref = createRef<ComponentRef<typeof Input.OTP>>();
    const { rerender } = render(
      <OtpInput
        aria-label="Verification code"
        aria-required
        ref={ref}
        value="123456"
      />,
    );
    const group = screen.getByRole("group", { name: "Verification code" });
    const inputs = screen.getAllByRole("textbox");
    for (const [index, input] of inputs.entries())
      expect(input).toHaveValue(String(index + 1));
    expect(ref.current?.nativeElement).toBe(group);
    act(() => ref.current?.focus());
    expect(inputs[0]).toHaveFocus();

    rerender(<OtpInput aria-label="Verification code" ref={ref} value="" />);
    for (const input of inputs) expect(input).toHaveValue("");
  });
});
