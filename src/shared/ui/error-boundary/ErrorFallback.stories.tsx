import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { i18n } from "@/shared/i18n";
import { ErrorFallback } from "@/shared/ui/error-boundary";

const meta = {
  title: "Shared/ErrorFallback",
  component: ErrorFallback,
} satisfies Meta<typeof ErrorFallback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(i18n.t("unexpectedError"))).toBeVisible();
    const reload = canvas.getByRole("button", { name: i18n.t("reload") });
    reload.focus();
    await expect(reload).toHaveFocus();
  },
};
export const PersianDark: Story = {
  ...Default,
  globals: { language: "fa", theme: "dark" },
};

const requestTitle = "Could not load this resource.";

export const Retry: Story = {
  args: { onRetry: fn(), title: requestTitle },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(requestTitle);
    await expect(canvas.getByText(i18n.t("unexpectedError"))).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("retry") }),
    );
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
