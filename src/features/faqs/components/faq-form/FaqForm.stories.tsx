import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { FaqForm } from "@/features/faqs/components/faq-form/FaqForm";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import { sampleFaqs, sampleUser } from "../../../../../.storybook/fixtures";

const meta = {
  title: "Features/FAQ/FaqForm",
  component: FaqForm,
  args: { onFinish: fn() },
  render: (args) => (
    <StoryShell initialEntries={["/faqs#create"]}>
      <FaqForm {...args} />
    </StoryShell>
  ),
} satisfies Meta<typeof FaqForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    const question = dialog.getByLabelText(i18n.t("question"));
    await waitFor(() => expect(question).toHaveFocus());
    await userEvent.type(question, "Can I edit a record?");
    await userEvent.type(
      dialog.getByLabelText(i18n.t("answer")),
      "Open its edit form and save your changes.",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: i18n.t("submit") }),
    );
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
export const Update: Story = {
  args: { id: sampleFaqs[0].id },
  render: (args) => (
    <StoryShell initialEntries={["/faqs#update"]}>
      <FaqForm {...args} />
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
      user={{ ...sampleUser, isSystemAdmin: false, permissions: ["faqs.read"] }}
    >
      <FaqForm {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    await expect(apiClient.get).not.toHaveBeenCalled();
  },
};
