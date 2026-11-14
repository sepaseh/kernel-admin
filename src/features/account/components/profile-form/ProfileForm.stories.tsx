import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ProfileForm } from "@/features/account/components/profile-form";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../../../.storybook/StoryShell";

const meta = {
  title: "Features/Account/ProfileForm",
  component: ProfileForm,
  render: () => (
    <StoryShell initialEntries={["/account"]}>
      <ProfileForm />
    </StoryShell>
  ),
} satisfies Meta<typeof ProfileForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentProfile: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(i18n.t("firstName"))).toHaveValue("Ada");
    await expect(canvas.getByLabelText(i18n.t("lastName"))).toHaveValue(
      "Lovelace",
    );
  },
};
export const SaveProfile: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstName = canvas.getByLabelText(i18n.t("firstName"));
    await userEvent.clear(firstName);
    await userEvent.type(firstName, "Augusta");
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("saveProfile") }),
    );
    await expect(apiClient.patch).toHaveBeenCalledWith(
      "/account/update-profile",
      { firstName: "Augusta", lastName: "Lovelace" },
      { signal: expect.any(AbortSignal) },
    );
    const success = await within(canvasElement.ownerDocument.body).findByText(
      i18n.t("profileUpdated"),
    );
    await waitFor(() => expect(success).toBeVisible());
  },
};
export const RequiredName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByLabelText(i18n.t("firstName")));
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("saveProfile") }),
    );
    await expect(canvas.getByLabelText(i18n.t("firstName"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(apiClient.patch).not.toHaveBeenCalled();
  },
};
