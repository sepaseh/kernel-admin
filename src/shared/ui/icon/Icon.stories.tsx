import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserRound } from "lucide-react";

const meta = {
  title: "Shared/Icons/Lucide/UserRound",
  component: UserRound,
  args: {
    "aria-hidden": true,
    color: "currentColor",
    size: 24,
    strokeWidth: 2,
  },
  argTypes: {
    "aria-hidden": { control: false },
    color: { control: "color" },
    size: { control: { min: 12, max: 64, step: 4, type: "range" } },
    strokeWidth: { control: { min: 1, max: 3, step: 0.5, type: "range" } },
  },
} satisfies Meta<typeof UserRound>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <UserRound aria-hidden size={16} />
      <UserRound aria-hidden size={24} />
      <UserRound aria-hidden size={32} />
    </div>
  ),
};
