import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FaqsPage } from "@/features/faqs";
import { apiClient } from "@/shared/api";
import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleFaqs, sampleUser } from "../../../.storybook/fixtures";
import { i18n } from "@/shared/i18n";

const meta = {
  title: "Features/FAQ",
  component: FaqsPage,
  render: () => (
    <StoryShell>
      <FaqsPage />
    </StoryShell>
  ),
} satisfies Meta<typeof FaqsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(sampleFaqs[0].question),
    ).toBeVisible();
    await expect(
      within(canvasElement).getByText(sampleFaqs[0].answer),
    ).toBeVisible();
  },
};
export const KeyboardReorder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(sampleFaqs[0].question)).toBeVisible();
    const handle = canvas.getAllByRole("button", { name: i18n.t("order") })[0];
    await waitFor(() => expect(handle).toBeEnabled());

    handle.focus();
    await userEvent.keyboard("[Space]");
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(sampleFaqs[0].id),
    );
    await userEvent.keyboard("[ArrowDown]");
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(
        `Draggable item ${sampleFaqs[0].id} was moved over droppable area ${sampleFaqs[1].id}.`,
      ),
    );
    await userEvent.keyboard("[Space]");

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/faqs/sort",
        { ids: [sampleFaqs[1].id, sampleFaqs[0].id] },
        { signal: undefined },
      ),
    );
    await waitFor(() =>
      expect(
        canvas
          .getAllByRole("cell")
          .filter((cell) =>
            sampleFaqs.some(({ question }) => cell.textContent === question),
          )
          .map((cell) => cell.textContent),
      ).toEqual([sampleFaqs[1].question, sampleFaqs[0].question]),
    );
  },
};
export const ReadOnly: Story = {
  render: () => (
    <StoryShell
      user={{ ...sampleUser, isSystemAdmin: false, permissions: ["faqs.read"] }}
    >
      <FaqsPage />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(sampleFaqs[0].question)).toBeVisible();
    for (const name of ["create", "update", "delete", "order"] as const)
      await expect(
        canvas.queryByRole("button", { name: i18n.t(name) }),
      ).not.toBeInTheDocument();
  },
};
export const Empty: Story = { parameters: { fixtureState: "empty" } };
export const Loading: Story = { parameters: { fixtureState: "loading" } };
export const RequestFailure: Story = {
  parameters: { fixtureState: "error" },
  play: async ({ canvasElement }) => {
    const message = await within(canvasElement.ownerDocument.body).findByText(
      "Synthetic FAQ service unavailable",
    );
    await waitFor(() => expect(message).toBeVisible());
  },
};
export const CreateRecord: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(sampleFaqs[0].question)).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: i18n.t("create") }),
    );
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
    );
    const question = within(dialog).getByLabelText(i18n.t("question"));
    const answer = within(dialog).getByLabelText(i18n.t("answer"));
    await waitFor(() => expect(question).toHaveFocus());
    await userEvent.type(question, "New synthetic question?");
    await userEvent.type(answer, "New synthetic answer.");
    await expect(question).toHaveValue("New synthetic question?");
    await expect(answer).toHaveValue("New synthetic answer.");
    await userEvent.click(
      within(dialog).getByRole("button", { name: i18n.t("submit") }),
    );
    await expect(
      await canvas.findByText("New synthetic question?"),
    ).toBeVisible();
  },
};
