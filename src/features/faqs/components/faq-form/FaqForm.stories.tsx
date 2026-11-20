import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useCallback } from "react";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";

import { FaqForm } from "@/features/faqs/components/faq-form/FaqForm";
import { apiClient } from "@/shared/api";
import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { sampleAccount, sampleFaqs } from "../../../../../.storybook/fixtures";
import { StoryShell } from "../../../../../.storybook/StoryShell";

const RoutedFaqForm = ({
  id,
  onClose,
  onFinish,
}: ComponentProps<typeof FaqForm>) => {
  const goBack = useGoBack();
  const handleClose = useCallback(() => {
    onClose();
    goBack();
  }, [goBack, onClose]);

  const handleFinish = () => {
    onFinish();
    goBack();
  };

  return <FaqForm id={id} onClose={handleClose} onFinish={handleFinish} />;
};

const meta = {
  title: "Features/FAQ/FaqForm",
  component: FaqForm,
  args: { onClose: fn(), onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/faqs#create"]}>
      <RoutedFaqForm {...args} />
    </StoryShell>
  ),
} satisfies Meta<typeof FaqForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", {
        name: i18n.t("create"),
      }),
    );
    const question = dialog.getByLabelText(i18n.t("question"));
    await waitFor(() => expect(question).toHaveFocus());
    await userEvent.type(question, "Can I edit a record?");
    await userEvent.type(
      dialog.getByLabelText(i18n.t("answer")),
      "Open its edit form and save your changes.",
    );
    dialog.getByRole("button", { name: i18n.t("submit") }).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledOnce());
    await expect(apiClient.post).toHaveBeenCalledWith(
      "/faqs",
      {
        question: "Can I edit a record?",
        answer: "Open its edit form and save your changes.",
      },
      { signal: expect.any(AbortSignal) },
    );
  },
};

export const Cancel: Story = {
  play: async ({ args, canvasElement }) => {
    const drawer = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: i18n.t("create") },
    );
    await userEvent.click(
      within(drawer).getByRole("button", { name: i18n.t("cancel") }),
    );

    await expect(args.onClose).toHaveBeenCalledOnce();
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};

export const Submitting: Story = {
  play: async ({ args, canvasElement }) => {
    const pending = deferred<Awaited<ReturnType<typeof apiClient.post>>>();
    mocked(apiClient.post).mockReturnValueOnce(pending.promise);
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", {
        name: i18n.t("create"),
      }),
    );
    const submit = dialog.getByRole("button", { name: i18n.t("submit") });
    const cancel = dialog.getByRole("button", { name: i18n.t("cancel") });

    try {
      await userEvent.type(
        dialog.getByLabelText(i18n.t("question")),
        sampleFaqs[0].question,
      );
      await userEvent.type(
        dialog.getByLabelText(i18n.t("answer")),
        sampleFaqs[0].answer,
      );
      await userEvent.click(submit);
      await waitFor(() => expect(submit).toBeDisabled());
      await userEvent.click(submit);
      await userEvent.click(cancel);

      await expect(apiClient.post).toHaveBeenCalledOnce();
      await expect(args.onClose).not.toHaveBeenCalled();
      await expect(args.onFinish).not.toHaveBeenCalled();
    } finally {
      pending.resolve(sampleFaqs[0]);
    }
    await waitFor(() => expect(args.onFinish).toHaveBeenCalledOnce());
  },
};

export const Update: Story = {
  args: { id: sampleFaqs[0].id },
  render: (args) => (
    <StoryShell initialEntries={["/faqs#update"]}>
      <RoutedFaqForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await waitFor(() =>
      expect(dialog.getByLabelText(i18n.t("question"))).toHaveValue(
        sampleFaqs[0].question,
      ),
    );
    await expect(dialog.getByLabelText(i18n.t("answer"))).toHaveValue(
      sampleFaqs[0].answer,
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
    await expect(dialog.getByLabelText(i18n.t("question"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(dialog.getByLabelText(i18n.t("answer"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(apiClient.post).not.toHaveBeenCalled();
  },
};
export const DeniedCreate: Story = {
  render: (args) => (
    <StoryShell
      initialEntries={["/faqs#create"]}
      initialUser={{
        ...sampleAccount,
        isSystemAdmin: false,
        permissions: ["faqs.read"],
      }}
    >
      <RoutedFaqForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
