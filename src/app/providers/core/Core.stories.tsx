import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CoreProvider } from "@/app/providers";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Providers/Core",
  component: CoreProvider,
  render: () => (
    <CoreProvider>
      <p>Accepted settings are available.</p>
    </CoreProvider>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Accepted: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(
        "Accepted settings are available.",
      ),
    ).toBeVisible();
  },
};
export const InitialFailure: Story = {
  parameters: { fixtureState: "settings-retry" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(i18n.t("settingsLoadFailed")),
    ).toBeVisible();
    await expect(
      canvas.queryByLabelText(i18n.t("loading")),
    ).not.toBeInTheDocument();
  },
};
