import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ContentsPage } from "@/features/contents";
import { i18n } from "@/shared/i18n";

import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleContents, sampleUser } from "../../../.storybook/fixtures";

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
      user={{
        ...sampleUser,
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
