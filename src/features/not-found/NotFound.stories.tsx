import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, userEvent, within } from "storybook/test";
import { NotFoundPage } from "@/features/not-found";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Features/NotFound",
  component: NotFoundPage,
  render: () => (
    <MemoryRouter initialEntries={["/missing"]}>
      <Routes>
        <Route path="/missing" element={<NotFoundPage />} />
        <Route path="/" element={<p>Home destination</p>} />
      </Routes>
    </MemoryRouter>
  ),
} satisfies Meta<typeof NotFoundPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(i18n.t("notFoundDescription")),
    ).toBeVisible();
  },
};
export const ReturnHome: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("backHome") }),
    );
    await expect(await canvas.findByText("Home destination")).toBeVisible();
  },
};
