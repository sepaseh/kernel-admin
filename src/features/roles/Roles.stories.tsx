import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { permissions, sampleAccount } from "@/test/storybook/fixtures";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { fetchPermissions, fetchRoles } from "./api";
import { RolesPage } from "./Roles";

const meta = {
  async beforeEach() {
    mocked(fetchPermissions).mockResolvedValue(permissions);
  },
  component: RolesPage,
  render: () => (
    <StoryShell initialEntries={["/roles"]}>
      <RolesPage />
    </StoryShell>
  ),
  title: "Features/Roles/Page",
} satisfies Meta<typeof RolesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Administrator")).toBeVisible();
    await expect(canvas.getByText("Editor")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: i18nInstance.t("create") }),
    ).toBeEnabled();
  },
};

export const EditSelectedRole: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("row", { name: /Editor/ });
    const update = within(editor).getByRole("button", {
      name: i18nInstance.t("update"),
    });
    await waitFor(() => expect(update).toBeEnabled());
    await userEvent.click(update);

    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    const name = await dialog.findByLabelText(i18nInstance.t("name"));
    await waitFor(() => expect(name).toHaveValue("Editor"));
    await userEvent.clear(name);
    await userEvent.type(name, "Content Editor");
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
    );

    await expect(await canvas.findByText("Content Editor")).toBeVisible();
    await expect(canvas.getByText("Administrator")).toBeVisible();
    await expect(canvas.queryByText("Editor")).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  beforeEach() {
    mocked(fetchRoles).mockResolvedValue([]);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.queryByText("Administrator")).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  beforeEach() {
    mocked(fetchRoles).mockReturnValue(new Promise(() => undefined));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.queryByText("Administrator")).not.toBeInTheDocument();
  },
};

export const LoadError: Story = {
  beforeEach() {
    mocked(fetchRoles).mockRejectedValue(new Error("Unable to load roles"));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("Unable to load roles")).toBeVisible();
    await expect(canvas.getByRole("table")).toBeVisible();
  },
};

export const ReadOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Administrator")).toBeVisible();
    for (const name of [
      i18nInstance.t("create"),
      i18nInstance.t("update"),
      i18nInstance.t("delete"),
    ]) {
      await expect(
        canvas.queryByRole("button", { name }),
      ).not.toBeInTheDocument();
    }
  },
  render: () => (
    <StoryShell
      initialEntries={["/roles"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["roles.read"],
      }}
    >
      <RolesPage />
    </StoryShell>
  ),
};
