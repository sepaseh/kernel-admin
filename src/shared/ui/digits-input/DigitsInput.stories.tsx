import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { DigitsInput } from "./DigitsInput";

const meta = {
  args: {
    "aria-label": "Numeric value",
    placeholder: "Digits only",
  },
  component: DigitsInput,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
  title: "Shared UI/DigitsInput",
} satisfies Meta<typeof DigitsInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Numeric value",
    });
    await userEvent.type(input, "ab12.34-xy");
    await expect(input).toHaveValue("1234");
  },
};

export const WithValue: Story = {
  args: { defaultValue: "123456" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Numeric value",
    });
    await expect(input).toHaveValue("123456");
    await userEvent.click(input);
    await userEvent.keyboard("{End}{Backspace}");
    await expect(input).toHaveValue("12345");
  },
};

export const Disabled: Story = {
  args: { defaultValue: "123456", disabled: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Numeric value",
    });
    await expect(input).toBeDisabled();
    await userEvent.type(input, "9");
    await expect(input).toHaveValue("123456");
  },
};
