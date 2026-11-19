import { apiClient } from "@/shared/api";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { sampleAccount } from "../../../.storybook/fixtures";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "../../../.storybook/StoryShell";

import { RolesPage } from "./Roles";

const meta = {
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
  parameters: { fixtureState: "roles-empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.queryByText("Administrator")).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: { fixtureState: "roles-loading" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.queryByText("Administrator")).not.toBeInTheDocument();
  },
};

export const LoadError: Story = {
  parameters: { fixtureState: "roles-error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByText("Synthetic roles unavailable")).toBeVisible(),
    );
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

export const CreateRole: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText("Administrator");
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("create") }),
    );
    const dialog = within(await body.findByRole("dialog"));
    const name = dialog.getByLabelText(i18nInstance.t("name"));
    await waitFor(() => expect(name).toHaveFocus());
    await userEvent.type(name, "Reviewers");
    await userEvent.click(dialog.getByRole("checkbox", { name: "View users" }));
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
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

export const ValidateRole: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Administrator");
    await userEvent.click(
      within(canvasElement).getByRole("button", {
        name: i18nInstance.t("create"),
      }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18nInstance.t("submit") }),
    );
    await expect(dialog.getByLabelText(i18nInstance.t("name"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
