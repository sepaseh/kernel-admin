import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ContentCategoriesPage } from "@/features/content-categories";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";

import { StoryShell } from "../../../.storybook/StoryShell";
import {
  sampleContentCategories,
  sampleAccount,
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
      initialUser={{
        ...sampleAccount,
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

export const SaveUpdatedCategory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const category = sampleContentCategories[0];
    const updatedName = "Updated documentation";
    const row = await canvas.findByRole("row", {
      name: new RegExp(category.name),
    });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("update") }),
    );
    const dialog = within(await body.findByRole("dialog"));
    const name = dialog.getByRole("textbox", { name: i18n.t("name") });
    await waitFor(() => expect(name).toHaveValue(category.name));
    await waitFor(() => expect(name).toHaveFocus());
    await userEvent.clear(name);
    await userEvent.type(name, updatedName);
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        `/content-categories/${category.id}`,
        { name: updatedName },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await expect(apiClient.patch).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(await canvas.findByText(updatedName)).toBeVisible();
    await expect(canvas.queryByText(category.name)).not.toBeInTheDocument();
    await expect(
      canvas.getByText(sampleContentCategories[1].name),
    ).toBeVisible();
    await expect(apiClient.get).toHaveBeenLastCalledWith(
      "/content-categories",
      { signal: expect.any(AbortSignal) },
    );
  },
};

export const DeleteRecord: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const category = sampleContentCategories[0];
    const row = await canvas.findByRole("row", {
      name: new RegExp(category.name),
    });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("delete") }),
    );
    const cancelledConfirmation = await body.findByRole("dialog");
    await waitFor(() => expect(cancelledConfirmation).toBeVisible());
    await expect(cancelledConfirmation).toHaveTextContent(
      i18n.t("deleteConfirm"),
    );
    await userEvent.click(
      within(cancelledConfirmation).getByRole("button", {
        name: i18n.t("no"),
      }),
    );

    await waitFor(() => expect(cancelledConfirmation).not.toBeInTheDocument());
    await expect(apiClient.del).not.toHaveBeenCalled();
    await expect(canvas.getByText(category.name)).toBeVisible();
    const retainedRow = canvas.getByRole("row", {
      name: new RegExp(category.name),
    });
    await userEvent.click(
      within(retainedRow).getByRole("button", { name: i18n.t("delete") }),
    );
    const confirmation = await body.findByRole("dialog");
    await waitFor(() => expect(confirmation).toBeVisible());
    await expect(confirmation).toHaveTextContent(i18n.t("deleteConfirm"));
    await userEvent.click(
      within(confirmation).getByRole("button", { name: i18n.t("yes") }),
    );

    await waitFor(() =>
      expect(apiClient.del).toHaveBeenCalledWith(
        `/content-categories/${category.id}`,
        { signal: undefined },
      ),
    );
    await expect(apiClient.del).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(canvas.queryByText(category.name)).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getByText(sampleContentCategories[1].name),
    ).toBeVisible();
    await expect(apiClient.get).toHaveBeenLastCalledWith(
      "/content-categories",
      { signal: expect.any(AbortSignal) },
    );
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
  },
};

export const KeyboardReorder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first, second] = sampleContentCategories;
    await expect(await canvas.findByText(first.name)).toBeVisible();
    const handle = canvas.getAllByRole("button", { name: i18n.t("order") })[0];
    await waitFor(() => expect(handle).toBeEnabled());

    handle.focus();
    await userEvent.keyboard("[Space]");
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(first.id),
    );
    await userEvent.keyboard("[ArrowDown]");
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(
        `Draggable item ${first.id} was moved over droppable area ${second.id}.`,
      ),
    );
    await userEvent.keyboard("[Space]");

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/content-categories/sort",
        { ids: [second.id, first.id] },
        { signal: undefined },
      ),
    );
    await expect(apiClient.patch).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        canvas
          .getAllByRole("cell")
          .filter((cell) =>
            sampleContentCategories.some(
              ({ name }) => cell.textContent === name,
            ),
          )
          .map((cell) => cell.textContent),
      ).toEqual([second.name, first.name]),
    );
    await expect(apiClient.get).toHaveBeenLastCalledWith(
      "/content-categories",
      { signal: expect.any(AbortSignal) },
    );
  },
};
