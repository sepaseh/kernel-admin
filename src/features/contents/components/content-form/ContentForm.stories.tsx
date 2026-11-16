import type { Meta, StoryObj } from "@storybook/react-vite";
import { useNavigate } from "react-router";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { ContentForm } from "@/features/contents/components/content-form/ContentForm";
import { apiClient } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { StoryShell } from "../../../../../.storybook/StoryShell";
import {
  sampleContentCategories,
  sampleContents,
  sampleAccount,
  sampleFiles,
  sampleSettings,
} from "../../../../../.storybook/fixtures";

const UploadHistoryControls = () => {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => void navigate(-1)} type="button">
        Browser back fixture
      </button>
      <button
        onClick={() => void navigate("/contents#create", { state: true })}
        type="button"
      >
        Reopen content form fixture
      </button>
    </div>
  );
};

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
      await dialog.findByRole(
        "textbox",
        { name: i18n.t("body") },
        { timeout: 5_000 },
      ),
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
      initialUser={{
        ...sampleAccount,
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

export const UploadBackReopen: Story = {
  render: (args) => (
    <StoryShell initialEntries={["/contents", "/contents#create"]}>
      <UploadHistoryControls />
      <ContentForm {...args} />
    </StoryShell>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const form = await body.findByRole("dialog");
    const dialog = within(form);
    const title = dialog.getByLabelText(i18n.t("title"));
    await waitFor(() => expect(title).toHaveFocus());
    await userEvent.type(title, "Unsaved content");

    const image = canvasElement.ownerDocument.createElement("canvas");
    const { width, height } = sampleSettings.imageSettings.contents;
    image.width = width;
    image.height = height;
    const context = image.getContext("2d");
    if (!context) throw new Error("Synthetic image canvas is unavailable");
    context.fillStyle = "#0958d9";
    context.fillRect(0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      image.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Synthetic image encoding failed"));
      }, "image/png");
    });
    const pending = deferred<Awaited<ReturnType<typeof apiClient.upload>>>();
    mocked(apiClient.upload).mockReturnValueOnce(pending.promise);
    const input = form.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Content cover upload input is missing");

    try {
      await userEvent.upload(
        input,
        new File([blob], "synthetic-cover.png", { type: "image/png" }),
      );
      const crop = await dialog.findByRole("dialog");
      await expect(crop).toHaveTextContent(i18n.t("cropImage"));
      await waitFor(() => {
        const media = crop.querySelector<HTMLImageElement>(".img-crop-media");
        const area = crop.querySelector<HTMLElement>(".reactEasyCrop_CropArea");
        expect(media?.naturalWidth).toBe(width);
        expect(area?.getBoundingClientRect().width).toBeGreaterThan(0);
      });
      await userEvent.click(
        within(crop).getByRole("button", { name: i18n.t("submit") }),
      );
      await waitFor(() => expect(apiClient.upload).toHaveBeenCalledOnce());
      await waitFor(() => expect(crop).not.toBeInTheDocument());
      await expect(apiClient.upload).toHaveBeenCalledWith(
        "/files",
        { context: "contents", file: expect.any(File) },
        { onUploadProgress: expect.any(Function), signal: undefined },
      );
      await expect(title).toBeDisabled();
      await expect(
        dialog.getByRole("button", { name: i18n.t("submit") }),
      ).toBeDisabled();

      await userEvent.click(
        canvas.getByRole("button", { name: "Browser back fixture" }),
      );
      await waitFor(() =>
        expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      await waitFor(() => expect(input).not.toBeInTheDocument());
      await userEvent.click(
        canvas.getByRole("button", { name: "Reopen content form fixture" }),
      );
      const reopened = within(await body.findByRole("dialog"));
      const reopenedTitle = reopened.getByLabelText(i18n.t("title"));
      const submit = reopened.getByRole("button", { name: i18n.t("submit") });
      await waitFor(() => expect(reopenedTitle).toBeEnabled());
      await expect(reopenedTitle).toHaveValue("");
      await expect(submit).toBeEnabled();

      pending.resolve(sampleFiles[1]);
      await pending.promise;
      await expect(reopenedTitle).toBeEnabled();
      await expect(submit).toBeEnabled();
      await expect(
        reopened.queryByRole("img", { name: i18n.t("coverImage") }),
      ).not.toBeInTheDocument();
      await expect(args.onFinish).not.toHaveBeenCalled();
      await expect(apiClient.post).not.toHaveBeenCalled();
    } finally {
      pending.resolve(sampleFiles[1]);
    }
  },
};
