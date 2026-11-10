import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { UserForm } from "@/features/users/components/user-form";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import { sampleUsers, sampleUser } from "../../../../../.storybook/fixtures";

const meta = {
  title: "Features/Users/UserForm",
  component: UserForm,
  args: { onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/users#create"]}>
      <UserForm {...args} />
    </StoryShell>
  ),
} satisfies Meta<typeof UserForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const firstName = dialog.getByLabelText(i18n.t("firstName"));
    await waitFor(() => expect(firstName).toHaveFocus());
    await userEvent.type(firstName, "Katherine");
    await userEvent.type(dialog.getByLabelText(i18n.t("lastName")), "Johnson");
    await userEvent.type(
      dialog.getByLabelText(i18n.t("mobile")),
      "09122222222",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledOnce());
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/users",
      {
        firstName: "Katherine",
        lastName: "Johnson",
        mobile: "09122222222",
        status: "active",
        password: expect.stringMatching(/^[a-z0-9]{16}$/),
      },
      { signal: expect.any(AbortSignal) },
    );
  },
};
export const Update: Story = {
  args: { id: sampleUsers[1].id },
  render: (args) => (
    <StoryShell initialEntries={["/users#update"]}>
      <UserForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await waitFor(() =>
      expect(dialog.getByLabelText(i18n.t("firstName"))).toHaveValue("Grace"),
    );
    await expect(dialog.getByLabelText(i18n.t("lastName"))).toHaveValue(
      "Hopper",
    );
    await expect(dialog.getByLabelText(i18n.t("mobile"))).toHaveValue(
      "09121111111",
    );
  },
};
export const RequiredFields: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(dialog.getByLabelText(i18n.t("firstName"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
export const DeniedCreate: Story = {
  render: (args) => (
    <StoryShell
      initialEntries={["/users#create"]}
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["users.read"],
      }}
    >
      <UserForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
