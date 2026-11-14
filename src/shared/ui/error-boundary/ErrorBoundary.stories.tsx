import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ErrorBoundary } from "@/shared/ui/error-boundary";

const meta = {
  title: "Shared/ErrorBoundary",
  component: ErrorBoundary,
} satisfies Meta<typeof ErrorBoundary>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  args: { children: <p>Application content</p> },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Application content"),
    ).toBeVisible();
  },
};
