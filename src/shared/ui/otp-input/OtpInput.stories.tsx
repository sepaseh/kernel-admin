import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { OtpInput } from "@/shared/ui/otp-input";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Shared/OtpInput",
  component: OtpInput,
  args: { "aria-label": "Verification code", length: 6, onChange: fn() },
} satisfies Meta<typeof OtpInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CompleteCode: Story = {
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
export const RequiredDescription: Story = {
  args: { "aria-required": true },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole("group", {
      name: "Verification code",
    });
    await expect(group).toHaveAccessibleDescription(i18n.t("requiredField"));
    await expect(group).not.toHaveAttribute("aria-required");
  },
};
export const Disabled: Story = {
  args: { disabled: true, value: "123456" },
  play: async ({ canvasElement }) => {
    for (const input of within(canvasElement).getAllByRole("textbox"))
      await expect(input).toBeDisabled();
  },
};
