import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { changePassword } from "@/features/auth";
import { i18nInstance } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { StoryShell } from "@/test/storybook/StoryShell";

import { PasswordForm } from "./PasswordForm";

const meta = {
  component: PasswordForm,
  render: () => (
    <StoryShell initialEntries={["/account"]}>
      <PasswordForm />
    </StoryShell>
  ),
  title: "Features/Account/Password Form",
} satisfies Meta<typeof PasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;
const fillPassword = async (canvas: ReturnType<typeof within>) => {
  await userEvent.type(
    canvas.getByLabelText(i18nInstance.t("currentPassword")),
    "old-secret",
  );
  await userEvent.type(
    canvas.getByLabelText(i18nInstance.t("newPassword")),
    "new-secret",
  );
  await userEvent.type(
    canvas.getByLabelText(i18nInstance.t("confirmPassword")),
    "new-secret",
  );
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText(i18nInstance.t("currentPassword")),
    ).toHaveValue("");
    await expect(
      canvas.getByLabelText(i18nInstance.t("newPassword")),
    ).toHaveValue("");
    await expect(
      canvas.getByRole("button", { name: i18nInstance.t("changePassword") }),
    ).toBeEnabled();
  },
};

export const Success: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillPassword(canvas);
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("changePassword") }),
    );
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith(
        { currentPassword: "old-secret", newPassword: "new-secret" },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByText(
          i18nInstance.t("passwordChanged"),
        ),
      ).toBeVisible(),
    );
  },
};

export const Validation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillPassword(canvas);
    const confirmation = canvas.getByLabelText(
      i18nInstance.t("confirmPassword"),
    );
    await userEvent.clear(confirmation);
    await userEvent.type(confirmation, "different-secret");
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("changePassword") }),
    );
    await waitFor(() =>
      expect(
        canvas.getByText(i18nInstance.t("passwordMismatch")),
      ).toBeVisible(),
    );
    await expect(changePassword).not.toHaveBeenCalled();
  },
};

export const RequestFailure: Story = {
  beforeEach() {
    mocked(changePassword).mockRejectedValueOnce(
      new Error("Password update unavailable"),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillPassword(canvas);
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("changePassword") }),
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByText(
          "Password update unavailable",
        ),
      ).toBeVisible(),
    );
    await expect(
      canvas.getByLabelText(i18nInstance.t("newPassword")),
    ).toHaveValue("new-secret");
    await expect(
      canvas.getByRole("button", { name: i18nInstance.t("changePassword") }),
    ).toBeEnabled();
  },
};

export const Submitting: Story = {
  beforeEach() {
    mocked(changePassword).mockReturnValue(deferred<void>().promise);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillPassword(canvas);
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("changePassword") }),
    );
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith(
        { currentPassword: "old-secret", newPassword: "new-secret" },
        expect.any(AbortSignal),
      ),
    );
    await expect(
      canvas.getByLabelText(i18nInstance.t("currentPassword")),
    ).toBeDisabled();
  },
};
