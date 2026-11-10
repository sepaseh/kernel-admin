import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ContentForm } from "@/features/contents/components/content-form/ContentForm";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import {
  sampleContentCategories,
  sampleContents,
  sampleUser,
} from "../../../../../.storybook/fixtures";

const meta = {
  title: "Features/Contents/ContentForm",
  component: ContentForm,
  args: { onFinish: fn(), options: { categories: sampleContentCategories } },
  render: (args) => (
    <StoryShell initialEntries={["/contents#create"]}>
      <ContentForm {...args} />
    </StoryShell>
  ),
} satisfies Meta<typeof ContentForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await expect(dialog.getByLabelText(i18n.t("title"))).toHaveValue("");
    await expect(
      dialog.getByRole("combobox", { name: i18n.t("category") }),
    ).toBeEnabled();
    await expect(
      await dialog.findByRole(
        "textbox",
        { name: i18n.t("body") },
        { timeout: 5_000 },
      ),
    ).toHaveAttribute("aria-readonly", "false");
  },
};
export const Update: Story = {
  args: { id: sampleContents[0].id },
  render: (args) => (
    <StoryShell initialEntries={["/contents#update"]}>
      <ContentForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await waitFor(() =>
      expect(dialog.getByLabelText(i18n.t("title"))).toHaveValue(
        sampleContents[0].title,
      ),
    );
    await expect(dialog.getByLabelText(i18n.t("excerpt"))).toHaveValue(
      sampleContents[0].excerpt,
    );
    await expect(
      dialog.getByRole("textbox", { name: i18n.t("body") }),
    ).toHaveTextContent("Open a record to review its details.");
    await expect(
      dialog.getByRole("img", { name: i18n.t("coverImage") }),
    ).toBeVisible();
  },
};
export const SaveExistingContent: Story = {
  args: { id: sampleContents[0].id },
  render: (args) => (
    <StoryShell initialEntries={["/contents#update"]}>
      <ContentForm {...args} />
    </StoryShell>
  ),
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const title = dialog.getByLabelText(i18n.t("title"));
    await waitFor(() => expect(title).toHaveFocus());
    await expect(title).toHaveValue(sampleContents[0].title);
    await userEvent.clear(title);
    await userEvent.type(title, "Updated guide");
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledOnce());
    await expect(apiClient.patch).toHaveBeenCalledWith(
      "/contents/content-1",
      {
        title: "Updated guide",
        excerpt: sampleContents[0].excerpt,
        body: sampleContents[0].body,
        contentCategoryId: "category-1",
        coverImageId: "file-used",
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
export const RequiredFields: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(dialog.getByLabelText(i18n.t("title"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    const bodyError = await dialog.findByText(i18n.t("bodyRequired"));
    await waitFor(() => expect(bodyError).toBeVisible());
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
export const DeniedCreate: Story = {
  render: (args) => (
    <StoryShell
      initialEntries={["/contents#create"]}
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["contents.read"],
      }}
    >
      <ContentForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(
      body.queryByRole("textbox", { name: i18n.t("body") }),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
