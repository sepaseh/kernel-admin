import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ContentCategoriesPage } from "@/features/content-categories";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";

import { StoryShell } from "../../../.storybook/StoryShell";
import {
  sampleContentCategories,
  sampleUser,
} from "../../../.storybook/fixtures";

const meta = {
  title: "Features/Content categories",
  component: ContentCategoriesPage,
  render: () => (
    <StoryShell initialEntries={["/content-categories"]}>
      <ContentCategoriesPage />
    </StoryShell>
  ),
} satisfies Meta<typeof ContentCategoriesPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const category of sampleContentCategories) {
      await expect(await canvas.findByText(category.name)).toBeVisible();
    }
  },
};
export const Empty: Story = {
  parameters: { fixtureState: "content-categories-empty" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("No data", {
        selector: ".ant-empty-description",
      }),
    ).toBeVisible();
  },
};
export const Loading: Story = {
  parameters: { fixtureState: "content-categories-loading" },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector(".ant-spin-spinning")).not.toBeNull(),
    );
  },
};
export const RequestFailure: Story = {
  parameters: { fixtureState: "content-categories-error" },
  play: async ({ canvasElement }) => {
    const message = await within(canvasElement.ownerDocument.body).findByText(
      "Synthetic content-categories unavailable",
    );
    await waitFor(() => expect(message).toBeVisible());
  },
};
export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      initialEntries={["/content-categories"]}
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["content-categories.read"],
      }}
    >
      <ContentCategoriesPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(sampleContentCategories[0].name);
    for (const action of ["create", "update", "delete", "order"] as const) {
      await expect(
        canvas.queryByRole("button", { name: i18n.t(action) }),
      ).not.toBeInTheDocument();
    }
  },
};
export const CreateRecord: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(sampleContentCategories[0].name);
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("create") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const name = dialog.getByRole("textbox", { name: i18n.t("name") });
    await waitFor(() => expect(name).toHaveFocus());
    await userEvent.type(name, "Release notes");
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );

    await expect(await canvas.findByText("Release notes")).toBeVisible();
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/content-categories",
      { name: "Release notes" },
      { signal: expect.any(AbortSignal) },
    );
  },
};
export const UpdateDrawer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const category = sampleContentCategories[0];
    const row = await canvas.findByRole("row", {
      name: new RegExp(category.name),
    });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("update") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const name = await dialog.findByRole("textbox", { name: i18n.t("name") });
    await waitFor(() => expect(name).toHaveFocus());
    await expect(name).toHaveValue(category.name);
  },
};
