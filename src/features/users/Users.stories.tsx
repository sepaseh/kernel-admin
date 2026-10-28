import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { sampleAccount, users } from "@/test/storybook/fixtures";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { fetchUsers, updateUserPassword } from "./api";
import { UsersPage } from "./Users";

const meta = {
  component: UsersPage,
  render: () => (
    <StoryShell initialEntries={["/users"]}>
      <UsersPage />
    </StoryShell>
  ),
  title: "Features/Users/Page",
} satisfies Meta<typeof UsersPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Sara Ahmadi")).toBeVisible();
    await expect(canvas.getByText("Ali Karimi")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: i18nInstance.t("create") }),
    ).toBeEnabled();
  },
};

export const Empty: Story = {
  beforeEach() {
    mocked(fetchUsers).mockResolvedValue({ items: [], total: 0 });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.queryByText("Sara Ahmadi")).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  beforeEach() {
    mocked(fetchUsers).mockReturnValue(new Promise(() => undefined));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.queryByText("Sara Ahmadi")).not.toBeInTheDocument();
  },
};

export const LoadError: Story = {
  beforeEach() {
    mocked(fetchUsers).mockRejectedValue(new Error("Unable to load users"));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Unable to load users")).toBeVisible();
    mocked(fetchUsers).mockResolvedValue({ items: users, total: users.length });
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("retry") }),
    );
    await expect(await canvas.findByText("Sara Ahmadi")).toBeVisible();
  },
};

export const PasswordConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(
      (
        await body.findAllByRole("button", { name: i18nInstance.t("password") })
      )[0],
    );

    const confirmation = await body.findByRole("dialog", {
      name: i18nInstance.t("passwordConfirm"),
    });
    await waitFor(() => expect(confirmation).toBeVisible());
    const dialog = within(confirmation);
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("no") }),
    );
    await waitFor(() => expect(confirmation).not.toBeVisible());
    await expect(updateUserPassword).not.toHaveBeenCalled();
  },
};

export const ReadOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Sara Ahmadi")).toBeVisible();
    for (const name of [
      i18nInstance.t("create"),
      i18nInstance.t("update"),
      i18nInstance.t("delete"),
      i18nInstance.t("password"),
    ]) {
      await expect(
        canvas.queryByRole("button", { name }),
      ).not.toBeInTheDocument();
    }
  },
  render: () => (
    <StoryShell
      initialEntries={["/users"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["users.read"],
      }}
    >
      <UsersPage />
    </StoryShell>
  ),
};
