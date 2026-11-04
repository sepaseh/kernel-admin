import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserRound } from "lucide-react";

const meta = {
  args: {
    "aria-hidden": true,
    color: "currentColor",
    size: 24,
    strokeWidth: 2,
  },
  argTypes: {
    "aria-hidden": { control: false },
    color: { control: "color" },
    size: { control: { max: 64, min: 12, step: 4, type: "range" } },
    strokeWidth: { control: { max: 3, min: 1, step: 0.5, type: "range" } },
  },
  component: UserRound,
  tags: ["autodocs"],
  title: "Shared UI/Icons/Lucide/UserRound",
} satisfies Meta<typeof UserRound>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div style={{ alignItems: "center", display: "flex", gap: 16 }}>
      <UserRound aria-hidden color="currentColor" size={16} />
      <UserRound aria-hidden color="currentColor" size={24} />
      <UserRound aria-hidden color="currentColor" size={32} />
    </div>
  ),
};
