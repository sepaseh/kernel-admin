import { apiClient } from "@/shared/api";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { sampleAccount } from "../../../../../.storybook/fixtures";
import { StoryShell } from "../../../../../.storybook/StoryShell";

import { ProfileForm } from "./ProfileForm";

const meta = {
  component: ProfileForm,
  render: () => (
    <StoryShell initialEntries={["/account"]}>
      <ProfileForm />
    </StoryShell>
  ),
  title: "Features/Account/Profile Form",
} satisfies Meta<typeof ProfileForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstName = canvas.getByLabelText(i18nInstance.t("firstName"));
    await expect(firstName).toHaveValue(sampleAccount.firstName);
    await userEvent.clear(firstName);
    await userEvent.type(firstName, "Samira");
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/account/update-profile",
        { firstName: "Samira", lastName: sampleAccount.lastName },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByText(
          i18nInstance.t("profileUpdated"),
        ),
      ).toBeVisible(),
    );
  },
};

export const Validation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstName = canvas.getByLabelText(i18nInstance.t("firstName"));
    await userEvent.clear(firstName);
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() =>
      expect(firstName).toHaveAttribute("aria-invalid", "true"),
    );
    await expect(apiClient.patch).not.toHaveBeenCalled();
  },
};

export const RequestFailure: Story = {
  beforeEach() {
    mocked(apiClient.patch).mockRejectedValueOnce(
      new Error("Profile update unavailable"),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstName = canvas.getByLabelText(i18nInstance.t("firstName"));
    await userEvent.clear(firstName);
    await userEvent.type(firstName, "Samira");
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByText(
          "Profile update unavailable",
        ),
      ).toBeVisible(),
    );
    await expect(firstName).toHaveValue("Samira");
    await expect(firstName).toBeEnabled();
  },
};

export const Submitting: Story = {
  beforeEach() {
    const pending = deferred<typeof sampleAccount>();
    mocked(apiClient.patch).mockReturnValue(pending.promise);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("saveProfile") }),
    );
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledOnce());
    await expect(
      canvas.getByLabelText(i18nInstance.t("firstName")),
    ).toBeDisabled();
  },
};
