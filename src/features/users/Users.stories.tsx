import { apiClient } from "@/shared/api";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { sampleAccount } from "../../../.storybook/fixtures";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";

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
  parameters: { fixtureState: "users-empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.queryByText("Sara Ahmadi")).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: { fixtureState: "users-loading" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.queryByText("Sara Ahmadi")).not.toBeInTheDocument();
  },
};

export const LoadError: Story = {
  parameters: { fixtureState: "users-error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByText("Synthetic users unavailable")).toBeVisible(),
    );
    await expect(canvas.getByRole("table")).toBeVisible();
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
    await expect(apiClient.put).not.toHaveBeenCalled();
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

export const CreateDrawer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("row", { name: /Ahmadi/ });
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("create") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const firstName = dialog.getByLabelText(i18nInstance.t("firstName"));
    await waitFor(() => expect(firstName).toHaveFocus());
    await userEvent.type(firstName, "Katherine");
    await userEvent.type(
      dialog.getByLabelText(i18nInstance.t("lastName")),
      "Johnson",
    );
    await userEvent.type(
      dialog.getByLabelText(i18nInstance.t("mobile")),
      "09122222222",
    );
    await expect(
      canvas.getByRole("textbox", { name: i18nInstance.t("firstName") }),
    ).not.toHaveAttribute("id", firstName.id);
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await expect(
      await canvas.findByRole("row", { name: /Johnson/ }),
    ).toBeVisible();
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/users",
      {
        firstName: "Katherine",
        lastName: "Johnson",
        mobile: "09122222222",
        status: "active",
        password: expect.stringMatching(/^.{16}$/),
      },
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("dialog"),
      ).not.toBeInTheDocument(),
    );
  },
};

export const UpdateDrawer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByRole("row", { name: /Karimi/ });
    await userEvent.click(
      within(row).getByRole("button", { name: i18nInstance.t("update") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const firstName = dialog.getByLabelText(i18nInstance.t("firstName"));
    await waitFor(() => expect(firstName).toHaveFocus());
    await expect(firstName).toHaveValue("Ali");
    await expect(dialog.getByLabelText(i18nInstance.t("mobile"))).toHaveValue(
      "09122222222",
    );
  },
};

export const RoleDrawer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByRole("row", { name: /Ahmadi/ });
    await userEvent.click(
      within(row).getByRole("button", { name: i18nInstance.t("roles") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const administrator = await dialog.findByRole("checkbox", {
      name: "Administrator",
    });
    await waitFor(() => expect(administrator).toBeChecked());
    await userEvent.click(dialog.getByRole("checkbox", { name: "Editor" }));
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await expect(apiClient.put).toHaveBeenCalledWith(
      "/users/user-1/roles",
      {
        roleIds: ["role-admin", "role-editor"],
      },
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole("dialog"),
      ).not.toBeInTheDocument(),
    );
  },
};
