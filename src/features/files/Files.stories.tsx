import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { FilesPage } from "@/features/files";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";

import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleFiles, sampleUser } from "../../../.storybook/fixtures";

const meta = {
  title: "Features/Files",
  component: FilesPage,
  render: () => (
    <StoryShell initialEntries={["/files"]}>
      <FilesPage />
    </StoryShell>
  ),
} satisfies Meta<typeof FilesPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const file of sampleFiles) {
      const row = within(
        await canvas.findByRole("row", { name: new RegExp(file.id) }),
      );
      await expect(
        row.getByRole("img", {
          name: i18n.t(file.isUsed ? "fileUsed" : "fileUnused"),
        }),
      ).toBeVisible();
      const remove = row.getByRole("button", { name: i18n.t("delete") });
      if (file.isUsed) await expect(remove).toBeDisabled();
      else await expect(remove).toBeEnabled();
    }
  },
};
export const Empty: Story = {
  parameters: { fixtureState: "files-empty" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("No data", {
        selector: ".ant-empty-description",
      }),
    ).toBeVisible();
  },
};
export const Loading: Story = {
  parameters: { fixtureState: "files-loading" },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector(".ant-spin-spinning")).not.toBeNull(),
    );
  },
};
export const RequestFailure: Story = {
  parameters: { fixtureState: "files-error" },
  play: async ({ canvasElement }) => {
    const message = await within(canvasElement.ownerDocument.body).findByText(
      "Synthetic files unavailable",
    );
    await waitFor(() => expect(message).toBeVisible());
  },
};
export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      initialEntries={["/files"]}
      user={{
        ...sampleUser,
        isSystemAdmin: false,
        permissions: ["files.read"],
      }}
    >
      <FilesPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(sampleFiles[0].id);
    await expect(
      canvas.queryByRole("button", { name: i18n.t("delete") }),
    ).not.toBeInTheDocument();
  },
};
export const DeleteUnused: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const unused = sampleFiles.find((file) => !file.isUsed)!;
    const row = await canvas.findByRole("row", { name: new RegExp(unused.id) });
    await userEvent.click(
      within(row).getByRole("button", { name: i18n.t("delete") }),
    );
    const confirmation = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.click(
      confirmation.getByRole("button", { name: i18n.t("yes") }),
    );

    await waitFor(() =>
      expect(canvas.queryByText(unused.id)).not.toBeInTheDocument(),
    );
    await expect(apiClient.del).toHaveBeenCalledWith(`/files/${unused.id}`, {
      signal: undefined,
    });
  },
};
