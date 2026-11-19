import type { Meta, StoryObj } from "@storybook/react-vite";
import { Route, Routes } from "react-router";
import { expect, within } from "storybook/test";

import { getAccessToken } from "@/shared/api";
import { StoryShell } from "../../../.storybook/StoryShell";

import { AuthLayout } from "./Auth";

const AuthContent = () => {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h1>Sign in</h1>
      <p>Authentication content renders inside the layout.</p>
      <output aria-label="Session state">
        {getAccessToken() ? "Signed in" : "Signed out"}
      </output>
    </section>
  );
};

const AuthLayoutStory = () => (
  <StoryShell initialEntries={["/auth"]}>
    <Routes>
      <Route element={<AuthLayout />} path="/auth">
        <Route index element={<AuthContent />} />
      </Route>
    </Routes>
  </StoryShell>
);

const meta = {
  component: AuthLayout,
  parameters: { ownsMain: true },
  render: () => <AuthLayoutStory />,
  title: "Layouts/Auth",
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Sign in" }),
    ).toBeVisible();
    await expect(await canvas.findByText("Signed out")).toBeVisible();
  },
};
