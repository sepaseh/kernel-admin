// @vitest-environment jsdom

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider, Upload, type UploadProps } from "antd";
import type ImgCrop from "antd-img-crop";
import { cloneElement, type ComponentProps, type ReactElement } from "react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { type StoredFile, uploadFile } from "@/features/files";
import { i18n } from "@/shared/i18n";
import { readImageSize } from "@/shared/ui/image-upload/image";
import { deferred } from "@/test/deferred";

import { createContent, fetchContent, updateContent } from "../../api";
import type { Content, ContentRequest } from "../../types";
import { ContentForm } from "./ContentForm";

const { messages, onFinish } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  onFinish: vi.fn(),
}));

vi.mock("../../api", () => ({
  createContent: vi.fn(),
  deleteContent: vi.fn(),
  fetchContent: vi.fn(),
  fetchContents: vi.fn(),
  updateContent: vi.fn(),
}));
vi.mock("@/features/files", () => ({ uploadFile: vi.fn() }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages }),
  useCore: () => ({
    settings: {
      imageSettings: { contents: { height: 240, size: 4096, width: 480 } },
      language: { direction: "ltr" },
    },
  }),
}));
vi.mock("@/shared/ui/image-upload/image", () => ({ readImageSize: vi.fn() }));
vi.mock("antd-img-crop", () => ({
  // Supply a synthetic cropped file while retaining Upload's input and request lifecycle.
  default: ({ beforeCrop, children }: ComponentProps<typeof ImgCrop>) => {
    const child = children as ReactElement<UploadProps>;
    return cloneElement(child, {
      beforeUpload: async (file, fileList) => {
        if (beforeCrop && (await beforeCrop(file, fileList)) === false)
          return Upload.LIST_IGNORE;

        const cropped = Object.assign(
          new File([file], file.name, {
            lastModified: file.lastModified,
            type: file.type,
          }),
          { lastModifiedDate: new Date(file.lastModified), uid: file.uid },
        );
        const accepted = await child.props.beforeUpload?.(cropped, [cropped]);
        return accepted === true ? cropped : accepted;
      },
    });
  },
}));
const editor: CurrentUser = {
  firstName: "Ada",
  id: "content-editor",
  isSystemAdmin: false,
  lastName: "Lovelace",
  mobile: "09120000000",
  permissions: ["contents.read", "contents.create", "contents.update"],
  status: "active",
};
const category = { id: "workshop", name: "Workshop notes" };
const existingCover = { id: "existing-cover", url: "/existing-cover.png" };
const uploadedCover: StoredFile = {
  id: "uploaded-cover",
  isUsed: false,
  size: 128,
  url: "/uploaded-cover.png",
};
const content: Content = {
  body: "<p>Existing body</p>",
  contentCategory: category,
  coverImage: existingCover,
  excerpt: "An existing excerpt",
  id: "content-1",
  title: "Existing title",
};
const existingRequest: ContentRequest = {
  body: content.body,
  contentCategoryId: category.id,
  coverImageId: existingCover.id,
  excerpt: content.excerpt,
  title: content.title,
};

const FormNavigation = () => {
  const { hash } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate("/contents#other")}>
        Leave content form
      </button>
      <output aria-label="Content form hash">{hash}</output>
    </>
  );
};

const renderForm = (hash: string, id?: Content["id"], currentUser = editor) =>
  render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <MemoryRouter initialEntries={[`/contents${hash}`]}>
        <FormNavigation />
        <Routes>
          <Route element={<Outlet context={{ currentUser }} />}>
            <Route
              path="/contents"
              element={
                <ContentForm
                  id={id}
                  onFinish={onFinish}
                  options={{ categories: [category] }}
                />
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </ConfigProvider>,
  );

const selectCover = (name: string) => {
  const drawer = screen.getByRole("dialog");
  const input = drawer.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("The cover file input is missing");

  fireEvent.change(input, {
    target: {
      files: [new File(["synthetic image bytes"], name, { type: "image/png" })],
    },
  });
};

const submitButton = () =>
  screen.getByRole("button", { name: i18n.t("submit") });
const formHash = () => screen.getByLabelText("Content form hash").textContent;

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(createContent).mockResolvedValue(content);
  vi.mocked(fetchContent).mockResolvedValue(content);
  vi.mocked(updateContent).mockResolvedValue(content);
  vi.mocked(uploadFile).mockResolvedValue(uploadedCover);
  vi.mocked(readImageSize).mockResolvedValue({ height: 240, width: 480 });
  await i18n.changeLanguage("en");
});

describe("content form", () => {
  it("requires visible body text and saves the selected category and uploaded cover", async () => {
    const pendingUpload = deferred<StoredFile>();
    vi.mocked(uploadFile)
      .mockRejectedValueOnce(new Error("Synthetic cover upload failed"))
      .mockReturnValueOnce(pendingUpload.promise);
    renderForm("#create");
    const user = userEvent.setup();
    const title = await screen.findByRole("textbox", { name: i18n.t("title") });
    const excerpt = screen.getByRole("textbox", { name: i18n.t("excerpt") });
    const body = await screen.findByRole("textbox", { name: i18n.t("body") });
    const submit = submitButton();

    fireEvent.change(title, { target: { value: "New title" } });
    fireEvent.change(excerpt, { target: { value: "A short excerpt" } });
    await user.click(
      screen.getByRole("combobox", { name: i18n.t("category") }),
    );
    await user.click(await screen.findByText(category.name));

    selectCover("failed-cover.png");
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Synthetic cover upload failed",
      ),
    );
    expect(submit).toBeEnabled();

    selectCover("cover.png");
    await waitFor(() =>
      expect(uploadFile).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "cover.png", type: "image/png" }),
        "contents",
        expect.any(Function),
      ),
    );
    expect(submit).toBeDisabled();
    expect(title).toBeDisabled();
    expect(body).toHaveAttribute("aria-readonly", "true");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("cancel") }));
    expect(formHash()).toBe("#create");
    expect(createContent).not.toHaveBeenCalled();

    await act(async () => pendingUpload.resolve(uploadedCover));
    expect(
      screen.getByRole("img", { name: i18n.t("coverImage") }),
    ).toHaveAttribute("src", uploadedCover.url);
    fireEvent.click(submit);
    expect(await screen.findByText(i18n.t("bodyRequired"))).toBeVisible();
    expect(createContent).not.toHaveBeenCalled();

    await user.type(body, "Visible content");
    fireEvent.click(submit);
    await waitFor(() =>
      expect(createContent).toHaveBeenCalledExactlyOnceWith(
        {
          body: expect.stringContaining("<p>Visible content</p>"),
          contentCategoryId: category.id,
          coverImageId: uploadedCover.id,
          excerpt: "A short excerpt",
          title: "New title",
        },
        expect.any(AbortSignal),
      ),
    );
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("contentSaved"),
    );
    expect(onFinish).toHaveBeenCalledOnce();
    await waitFor(() => expect(formHash()).toBe(""));
    expect(updateContent).not.toHaveBeenCalled();
  });

  it("waits for edit details and retains the draft for retry after a rejected save", async () => {
    const pendingDetails = deferred<Content>();
    vi.mocked(fetchContent).mockReturnValueOnce(pendingDetails.promise);
    vi.mocked(updateContent).mockRejectedValueOnce(
      new Error("Synthetic save failed"),
    );
    renderForm("#update", content.id);
    const submit = await screen.findByRole("button", {
      name: i18n.t("submit"),
    });
    expect(submit).toBeDisabled();
    expect(fetchContent).toHaveBeenCalledExactlyOnceWith(
      content.id,
      expect.any(AbortSignal),
    );

    await act(async () => pendingDetails.resolve(content));
    const title = await screen.findByRole("textbox", { name: i18n.t("title") });
    expect(title).toHaveValue(content.title);
    expect(
      screen.getByRole("textbox", { name: i18n.t("excerpt") }),
    ).toHaveValue(content.excerpt);
    expect(
      await screen.findByRole("textbox", { name: i18n.t("body") }),
    ).toHaveTextContent("Existing body");
    expect(
      screen.getByRole("img", { name: i18n.t("coverImage") }),
    ).toHaveAttribute("src", existingCover.url);
    expect(submit).toBeEnabled();

    fireEvent.change(title, { target: { value: "Updated title" } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Synthetic save failed",
      ),
    );
    expect(title).toHaveValue("Updated title");
    expect(formHash()).toBe("#update");
    expect(submit).toBeEnabled();
    expect(onFinish).not.toHaveBeenCalled();

    fireEvent.click(submit);
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(updateContent).toHaveBeenCalledTimes(2);
    expect(updateContent).toHaveBeenLastCalledWith(
      content.id,
      { ...existingRequest, title: "Updated title" },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("contentSaved"),
    );
    await waitFor(() => expect(formHash()).toBe(""));
    expect(createContent).not.toHaveBeenCalled();
  });

  it("rejects a stored body made only of markup and invisible characters", async () => {
    vi.mocked(fetchContent).mockResolvedValueOnce({
      ...content,
      body: "<style>p { color: red }</style><script>hiddenText</script><p>&nbsp;&#8203;</p>",
    });
    renderForm("#update", content.id);
    await screen.findByDisplayValue(content.title);
    await screen.findByRole("textbox", { name: i18n.t("body") });

    fireEvent.click(submitButton());

    expect(await screen.findByText(i18n.t("bodyRequired"))).toBeVisible();
    expect(formHash()).toBe("#update");
    expect(updateContent).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"] as const)(
    "aborts a pending edit save when leaving and ignores a late %s",
    async (outcome) => {
      const pendingSave = deferred<Content>();
      vi.mocked(updateContent).mockReturnValueOnce(pendingSave.promise);
      renderForm("#update", content.id);
      await screen.findByDisplayValue(content.title);
      fireEvent.click(submitButton());
      await waitFor(() => expect(updateContent).toHaveBeenCalledOnce());
      const signal = vi.mocked(updateContent).mock.calls[0][2];

      fireEvent.click(screen.getByText("Leave content form"));
      expect(signal?.aborted).toBe(true);
      await act(async () => {
        if (outcome === "success") pendingSave.resolve(content);
        else pendingSave.reject(new Error("Synthetic stale save failure"));
      });

      expect(formHash()).toBe("#other");
      expect(messages.success).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
    },
  );

  it("aborts the detail read when the editor cancels and ignores a late response", async () => {
    const pendingDetails = deferred<Content>();
    vi.mocked(fetchContent).mockReturnValueOnce(pendingDetails.promise);
    renderForm("#update", content.id);
    const cancel = await screen.findByRole("button", {
      name: i18n.t("cancel"),
    });
    const signal = vi.mocked(fetchContent).mock.calls[0][1];

    fireEvent.click(cancel);
    expect(signal?.aborted).toBe(true);
    await act(async () => pendingDetails.resolve(content));

    expect(formHash()).toBe("");
    expect(screen.queryByDisplayValue(content.title)).not.toBeInTheDocument();
    expect(messages.error).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("reports a failed detail read and leaves the edit drawer", async () => {
    vi.mocked(fetchContent).mockRejectedValueOnce(
      new Error("Synthetic details failed"),
    );
    renderForm("#update", content.id);

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Synthetic details failed",
      ),
    );
    await waitFor(() => expect(formHash()).toBe(""));
    expect(updateContent).not.toHaveBeenCalled();
  });

  it.each(["#create", "#update"])(
    "rejects a direct %s hash for a read-only user",
    async (hash) => {
      renderForm(hash, content.id, {
        ...editor,
        permissions: ["contents.read"],
      });

      await waitFor(() => expect(formHash()).toBe(""));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(fetchContent).not.toHaveBeenCalled();
      expect(createContent).not.toHaveBeenCalled();
      expect(updateContent).not.toHaveBeenCalled();
    },
  );

  it("leaves an edit route with no selected record", async () => {
    renderForm("#update");

    await waitFor(() => expect(formHash()).toBe(""));
    expect(fetchContent).not.toHaveBeenCalled();
  });
});
