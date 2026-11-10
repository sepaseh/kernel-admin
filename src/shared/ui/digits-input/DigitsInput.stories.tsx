import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DigitsInput } from "@/shared/ui/digits-input";

const meta = {
  title: "Shared/DigitsInput",
  component: DigitsInput,
  args: { "aria-label": "Mobile digits", onChange: fn() },
} satisfies Meta<typeof DigitsInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FiltersNonDigits: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Mobile digits",
    });
    await userEvent.type(input, "09a12-34");
    await expect(input).toHaveValue("091234");
  },
};
export const NormalizesInitialValue: Story = {
  args: { defaultValue: "09 12-34" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "091234",
    );
  },
};
export const Disabled: Story = {
  args: { disabled: true, value: "09120000000" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toBeDisabled();
  },
};
