import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";

import { OtpInput } from "./OtpInput";

const meta = {
  args: { "aria-label": "Verification code", length: 6, onChange: fn() },
  component: OtpInput,
  parameters: { layout: "centered" },
  title: "Shared UI/OtpInput",
} satisfies Meta<typeof OtpInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ args, canvasElement }) => {
    const group = within(canvasElement).getByRole("group", {
      name: "Verification code",
    });
    const inputs = within(group).getAllByRole("textbox");
    await userEvent.type(inputs[0], "123456");
    await expect(args.onChange).toHaveBeenCalledWith("123456");
    for (const [index, input] of inputs.entries())
      await expect(input).toHaveValue(String(index + 1));
  },
};
export const WithValue: Story = {
  args: { value: "123456" },
  play: async ({ canvasElement }) => {
    const inputs = within(canvasElement).getAllByRole("textbox");
    for (const [index, input] of inputs.entries())
      await expect(input).toHaveValue(String(index + 1));
  },
};
export const Disabled: Story = {
  args: { disabled: true, value: "123456" },
  play: async ({ canvasElement }) => {
    for (const input of within(canvasElement).getAllByRole("textbox"))
      await expect(input).toBeDisabled();
  },
};
export const FourDigits: Story = {
  args: { length: 4, value: "1234" },
  play: async ({ canvasElement }) => {
    const inputs = within(canvasElement).getAllByRole("textbox");
    await expect(inputs).toHaveLength(4);
    for (const [index, input] of inputs.entries())
      await expect(input).toHaveValue(String(index + 1));
  },
};
export const Required: Story = {
  args: { "aria-required": true },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole("group", {
      name: "Verification code",
    });
    await expect(group).toHaveAccessibleDescription(
      i18nInstance.t("requiredField"),
    );
    await expect(group).not.toHaveAttribute("aria-required");
  },
};
