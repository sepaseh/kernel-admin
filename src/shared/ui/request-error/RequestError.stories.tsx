import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { RequestError } from "@/shared/ui/request-error";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Shared/RequestError",
  component: RequestError,
  args: { error: new Error("Could not load this resource."), onRetry: fn() },
} satisfies Meta<typeof RequestError>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Retry: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      args.error.message,
    );
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("retry") }),
    );
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
export const GenericFallback: Story = {
  args: { error: new Error("") },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      i18n.t("unexpectedError"),
    );
  },
};
