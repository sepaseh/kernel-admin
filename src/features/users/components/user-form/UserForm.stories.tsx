import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { createUser } from "@/features/users/api";
import { user } from "@/test/storybook/fixtures";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { UserForm } from "./UserForm";

const meta = {
  component: UserForm,
  title: "Features/Users/UserForm",
} satisfies Meta<typeof UserForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  args: { onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/#create"]}>
      <UserForm {...args} />
    </StoryShell>
  ),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.type(
      dialog.getByLabelText(i18nInstance.t("firstName")),
      "Mina",
    );
    await userEvent.type(
      dialog.getByLabelText(i18nInstance.t("lastName")),
      "Rahimi",
    );
    await userEvent.type(
      dialog.getByLabelText(i18nInstance.t("mobile")),
      "09123334444",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(
        {
          firstName: "Mina",
          lastName: "Rahimi",
          mobile: "09123334444",
          password: expect.stringMatching(/^[a-z0-9]{16}$/),
        },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledTimes(1));
  },
};

export const Update: Story = {
  args: { data: user, onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/#update"]}>
      <UserForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await expect(
      dialog.getByLabelText(i18nInstance.t("firstName")),
    ).toHaveValue("Sara");
    await expect(dialog.getByLabelText(i18nInstance.t("lastName"))).toHaveValue(
      "Ahmadi",
    );
    await expect(dialog.getByLabelText(i18nInstance.t("mobile"))).toHaveValue(
      "09121111111",
    );
  },
};

export const ValidationErrors: Story = {
  args: { onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/#create"]}>
      <UserForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      body.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await expect(
      body.getByLabelText(i18nInstance.t("firstName")),
    ).toHaveAttribute("aria-invalid", "true");
  },
};
