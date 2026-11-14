import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { RolesPage } from "@/features/roles";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleUser } from "../../../.storybook/fixtures";

const meta = {
  title: "Features/Roles",
  component: RolesPage,
  render: () => (
    <StoryShell initialEntries={["/roles"]}>
      <RolesPage />
    </StoryShell>
  ),
} satisfies Meta<typeof RolesPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("Administrator"),
    ).toBeVisible();
    await expect(within(canvasElement).getByText("Editor")).toBeVisible();
  },
};
export const Empty: Story = { parameters: { fixtureState: "roles-empty" } };
export const Loading: Story = { parameters: { fixtureState: "roles-loading" } };
export const RequestFailure: Story = {
  parameters: { fixtureState: "roles-error" },
  play: async ({ canvasElement }) => {
    const error = await within(canvasElement.ownerDocument.body).findByText(
      "Synthetic roles unavailable",
    );
    await waitFor(() => expect(error).toBeVisible());
  },
};
export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["roles.read"],
      }}
    >
      <RolesPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Administrator")).toBeVisible();
    for (const name of ["create", "update", "delete"] as const)
      await expect(
        canvas.queryByRole("button", { name: i18n.t(name) }),
      ).not.toBeInTheDocument();
  },
};
export const CreateRole: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText("Administrator");
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("create") }),
    );
    const dialog = within(await body.findByRole("dialog"));
    const name = dialog.getByLabelText(i18n.t("name"));
    await waitFor(() => expect(name).toHaveFocus());
    await userEvent.type(name, "Reviewers");
    await userEvent.click(dialog.getByRole("checkbox", { name: "View users" }));
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(await canvas.findByText("Reviewers")).toBeVisible();
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/roles",
      {
        name: "Reviewers",
        permissions: ["users.read"],
      },
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};
export const UpdateRole: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const row = await canvas.findByRole("row", { name: /Editor/ });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("update") }),
    );
    const dialog = within(await body.findByRole("dialog"));
    const name = dialog.getByLabelText(i18n.t("name"));
    await waitFor(() => expect(name).toHaveFocus());
    await expect(name).toHaveValue("Editor");
    await expect(
      dialog.getByRole("checkbox", { name: "View users" }),
    ).toBeChecked();
    await userEvent.clear(name);
    await userEvent.type(name, "Content Editor");
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(await canvas.findByText("Content Editor")).toBeVisible();
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};
export const ValidateRole: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Administrator");
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: i18n.t("create") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(dialog.getByLabelText(i18n.t("name"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
