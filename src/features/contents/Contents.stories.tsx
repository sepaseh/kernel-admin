import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { ContentsPage } from "@/features/contents";
import { apiClient } from "@/shared/api";
import { defaultPageSize } from "@/shared/config";
import { i18n } from "@/shared/i18n";

import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleContents, sampleAccount } from "../../../.storybook/fixtures";

const meta = {
  title: "Features/Contents",
  component: ContentsPage,
  render: () => (
    <StoryShell initialEntries={["/contents"]}>
      <ContentsPage />
    </StoryShell>
  ),
} satisfies Meta<typeof ContentsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const content of sampleContents) {
      const row = within(
        await canvas.findByRole("row", { name: new RegExp(content.title) }),
      );
      await expect(row.getByText(content.contentCategory.name)).toBeVisible();
    }
  },
};
export const Empty: Story = {
  parameters: { fixtureState: "contents-empty" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("No data", {
        selector: ".ant-empty-description",
      }),
    ).toBeVisible();
  },
};
export const Loading: Story = {
  parameters: { fixtureState: "contents-loading" },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector(".ant-spin-spinning")).not.toBeNull(),
    );
    await expect(
      within(canvasElement).queryByText(sampleContents[0].title),
    ).not.toBeInTheDocument();
  },
};
export const RequestFailure: Story = {
  parameters: { fixtureState: "contents-error" },
  play: async ({ canvasElement }) => {
    const message = await within(canvasElement.ownerDocument.body).findByText(
      "Synthetic contents unavailable",
    );
    await waitFor(() => expect(message).toBeVisible());
  },
};
export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      initialEntries={["/contents"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["contents.read"],
      }}
    >
      <ContentsPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(sampleContents[0].title);
    for (const action of ["create", "update", "delete"] as const) {
      await expect(
        canvas.queryByRole("button", { name: i18n.t(action) }),
      ).not.toBeInTheDocument();
    }
  },
};
export const UpdateDrawer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByRole("row", {
      name: new RegExp(sampleContents[0].title),
    });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("update") }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const title = await dialog.findByLabelText(i18n.t("title"));
    await waitFor(() => expect(title).toHaveFocus());
    await expect(title).toHaveValue(sampleContents[0].title);
    await expect(dialog.getByLabelText(i18n.t("excerpt"))).toHaveValue(
      sampleContents[0].excerpt,
    );
    await expect(
      canvas.getByRole("textbox", { name: i18n.t("title") }),
    ).not.toHaveAttribute("id", title.id);
  },
};
export const PersianDark: Story = {
  globals: { language: "fa", theme: "dark" },
  ...Populated,
};

export const DeleteReturnsToFirstPage: Story = {
  beforeEach: async () => {
    for (let index = 1; index <= defaultPageSize + 2; index += 1) {
      await apiClient.post("/contents", {
        title: `Paged content ${index}`,
        body: "<p>Synthetic paginated content.</p>",
        excerpt: "Synthetic page fixture.",
        contentCategoryId: sampleContents[0].contentCategory.id,
        coverImageId: sampleContents[0].coverImage.id,
      });
    }
  },
  render: () => (
    <StoryShell
      initialEntries={[
        `/contents?page=2&title=Paged+content&contentCategoryId=${sampleContents[0].contentCategory.id}`,
      ]}
    >
      <ContentsPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const row = await canvas.findByRole("row", {
      name: new RegExp(`Paged content ${defaultPageSize + 2}`),
    });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("delete") }),
    );
    const confirmation = await body.findByRole("dialog");
    await expect(confirmation).toHaveTextContent(i18n.t("deleteConfirm"));
    await userEvent.click(
      within(confirmation).getByRole("button", { name: i18n.t("yes") }),
    );

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenLastCalledWith("/contents", {
        params: {
          page: "1",
          title: "Paged content",
          content_category_id: sampleContents[0].contentCategory.id,
        },
        signal: expect.any(AbortSignal),
      }),
    );
    await expect(apiClient.del).toHaveBeenCalledWith(
      `/contents/content-created-${defaultPageSize + 2}`,
      { signal: undefined },
    );
    await expect(apiClient.del).toHaveBeenCalledTimes(1);
    await expect(await canvas.findByText("Paged content 1")).toBeVisible();
    await expect(
      canvas.queryByText(`Paged content ${defaultPageSize + 1}`),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("textbox", { name: i18n.t("title") }),
    ).toHaveValue("Paged content");
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
  },
};

export const DeleteRefreshesFirstPage: Story = {
  render: () => (
    <StoryShell initialEntries={["/contents?page=1"]}>
      <ContentsPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const content = sampleContents[0];
    const row = await canvas.findByRole("row", {
      name: new RegExp(content.title),
    });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("delete") }),
    );
    const confirmation = await body.findByRole("dialog");
    await expect(confirmation).toHaveTextContent(i18n.t("deleteConfirm"));
    await userEvent.click(
      within(confirmation).getByRole("button", { name: i18n.t("yes") }),
    );

    await waitFor(() =>
      expect(canvas.queryByText(content.title)).not.toBeInTheDocument(),
    );
    await expect(canvas.getByText(sampleContents[1].title)).toBeVisible();
    await expect(apiClient.del).toHaveBeenCalledWith(
      `/contents/${content.id}`,
      { signal: undefined },
    );
    await expect(apiClient.del).toHaveBeenCalledTimes(1);
    await expect(
      mocked(apiClient.get).mock.calls.filter(([url]) => url === "/contents"),
    ).toHaveLength(2);
    await expect(apiClient.get).toHaveBeenLastCalledWith("/contents", {
      params: {
        page: "1",
        title: undefined,
        content_category_id: undefined,
      },
      signal: expect.any(AbortSignal),
    });
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
  },
};
