import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useCallback } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ContentCategoryForm } from "@/features/content-categories/components/content-category-form/ContentCategoryForm";
import { apiClient } from "@/shared/api";
import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";

import {
  sampleAccount,
  sampleContentCategories,
} from "../../../../../.storybook/fixtures";
import { StoryShell } from "../../../../../.storybook/StoryShell";

const RoutedContentCategoryForm = ({
  id,
  onClose,
  onFinish,
}: ComponentProps<typeof ContentCategoryForm>) => {
  const goBack = useGoBack();
  const handleClose = useCallback(() => {
    onClose();
    goBack();
  }, [goBack, onClose]);

  const handleFinish = () => {
    onFinish();
    goBack();
  };

  return (
    <ContentCategoryForm
      id={id}
      onClose={handleClose}
      onFinish={handleFinish}
    />
  );
};

const meta = {
  title: "Features/ContentCategories/ContentCategoryForm",
  component: ContentCategoryForm,
  args: { onClose: fn(), onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/content-categories#create"]}>
      <RoutedContentCategoryForm {...args} />
    </StoryShell>
  ),
} satisfies Meta<typeof ContentCategoryForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const name = dialog.getByLabelText(i18n.t("name"));
    await waitFor(() => expect(name).toHaveFocus());
    await userEvent.type(name, "Tutorials");
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledOnce());
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/content-categories",
      { name: "Tutorials" },
      { signal: expect.any(AbortSignal) },
    );
  },
};
export const Update: Story = {
  args: { id: sampleContentCategories[0].id },
  render: (args) => (
    <StoryShell initialEntries={["/content-categories#update"]}>
      <RoutedContentCategoryForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await waitFor(() =>
      expect(dialog.getByLabelText(i18n.t("name"))).toHaveValue(
        "Documentation",
      ),
    );
  },
};
export const RequiredName: Story = {
  play: async ({ canvasElement }) => {
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
export const DeniedCreate: Story = {
  render: (args) => (
    <StoryShell
      initialEntries={["/content-categories#create"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["content-categories.read"],
      }}
    >
      <RoutedContentCategoryForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
