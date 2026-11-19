// @vitest-environment jsdom

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { type ModalFuncProps } from "antd";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { fetchContentCategories } from "@/features/content-categories";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { deleteContent, fetchContent, fetchContents } from "./api";
import { ContentsPage } from "./Contents";
import type { Content } from "./types";

const { messages, modal } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn<(options: ModalFuncProps) => void>() },
}));
vi.mock("./api", () => ({
  createContent: vi.fn(),
  deleteContent: vi.fn(),
  fetchContent: vi.fn(),
  fetchContents: vi.fn(),
  updateContent: vi.fn(),
}));
vi.mock("@/features/content-categories", () => ({
  fetchContentCategories: vi.fn(),
}));
vi.mock("@/features/files", () => ({ uploadFile: vi.fn() }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({
    messageAPI: messages,
    modalAPI: modal,
    token: { marginLG: 24 },
  }),
  useCore: () => ({
    settings: {
      imageSettings: { contents: { width: 300, height: 200, size: 10_000 } },
      language: { direction: "ltr" },
    },
  }),
}));

const category = { id: "category-1", name: "Documentation" };
const guide: Content = {
  body: "<p>Manage your account.</p>",
  contentCategory: category,
  coverImage: { id: "guide-cover", url: "/synthetic-guide-cover.png" },
  excerpt: "Account settings and preferences.",
  id: "guide-1",
  title: "Account guide",
};
const reader: CurrentUser = {
  firstName: "Ada",
  id: "synthetic-admin",
  isSystemAdmin: false,
  lastName: "Lovelace",
  mobile: "09120000000",
  permissions: ["contents.read"],
  status: "active",
};

const LocationDisplay = () => {
  const { pathname, search, hash } = useLocation();
  return (
    <output aria-label="Current location">{pathname + search + hash}</output>
  );
};

const renderPage = (
  path = "/contents",
  permissions: CurrentUser["permissions"] = reader.permissions,
) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocationDisplay />
      <Routes>
        <Route
          element={
            <Outlet context={{ currentUser: { ...reader, permissions } }} />
          }
        >
          <Route path="/contents" element={<ContentsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const confirmDeletion = () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(modal.confirm).toHaveBeenCalledOnce();
  const confirm = modal.confirm.mock.calls[0][0].onOk;
  if (!confirm) throw new Error("Delete confirmation handler is missing");
  return confirm;
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchContentCategories).mockResolvedValue([category]);
  vi.mocked(fetchContent).mockResolvedValue(guide);
  vi.mocked(fetchContents).mockResolvedValue({ items: [guide], total: 72 });
  await i18n.changeLanguage("en");
});

describe("contents listing", () => {
  it("reads filters and pagination from the URL and hides write actions for readers", async () => {
    renderPage("/contents?page=3&title=Account&contentCategoryId=category-1");

    const row = await screen.findByRole("row", {
      name: /49 Account guide Documentation/,
    });
    expect(row).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Account",
    );
    expect(fetchContents).toHaveBeenCalledExactlyOnceWith(
      { page: "3", title: "Account", contentCategoryId: category.id },
      expect.any(AbortSignal),
    );
    for (const name of ["Create", "Update", "Delete"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("debounces a title change and resets pagination while retaining the category", async () => {
    renderPage("/contents?page=3&title=Account&contentCategoryId=category-1");
    await screen.findByText(guide.title);
    vi.mocked(fetchContents).mockResolvedValueOnce({ items: [], total: 0 });

    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
        target: { value: "Billing" },
      });
      expect(fetchContents).toHaveBeenCalledOnce();
      await act(async () => vi.advanceTimersByTimeAsync(500));
    } finally {
      vi.useRealTimers();
    }

    expect(fetchContents).toHaveBeenLastCalledWith(
      { title: "Billing", contentCategoryId: category.id },
      expect.any(AbortSignal),
    );
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "/contents?title=Billing&contentCategoryId=category-1",
    );
    expect(screen.queryByText(guide.title)).not.toBeInTheDocument();
  });

  it("cancels a superseded page request and retains the current results", async () => {
    const olderPage = deferred<{ items: Content[]; total: number }>();
    const newest = { ...guide, id: "guide-3", title: "Newest page guide" };
    vi.mocked(fetchContents)
      .mockResolvedValueOnce({ items: [guide], total: 72 })
      .mockReturnValueOnce(olderPage.promise)
      .mockResolvedValueOnce({ items: [newest], total: 72 });
    renderPage();
    await screen.findByText(guide.title);

    fireEvent.click(within(screen.getByTitle("2")).getByRole("button"));
    await waitFor(() => expect(fetchContents).toHaveBeenCalledTimes(2));
    const pageTwoSignal = vi.mocked(fetchContents).mock.calls[1][1];
    fireEvent.click(within(screen.getByTitle("3")).getByRole("button"));

    expect(await screen.findByText(newest.title)).toBeInTheDocument();
    expect(pageTwoSignal?.aborted).toBe(true);
    await act(async () => {
      olderPage.resolve({
        items: [{ ...guide, id: "guide-2", title: "Superseded page guide" }],
        total: 72,
      });
    });
    expect(screen.queryByText("Superseded page guide")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "/contents?page=3",
    );
  });

  it("opens the selected content for editing and preserves the current query on return", async () => {
    renderPage("/contents?title=Account", [
      "contents.read",
      "contents.create",
      "contents.update",
    ]);
    await screen.findByText(guide.title);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(await screen.findByDisplayValue(guide.excerpt)).toBeInTheDocument();
    expect(fetchContent).toHaveBeenCalledExactlyOnceWith(
      guide.id,
      expect.any(AbortSignal),
    );
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "/contents?title=Account#update",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current location")).toHaveTextContent(
        /^\/contents\?title=Account$/,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current location")).toHaveTextContent(
        "/contents?title=Account#create",
      ),
    );
    expect(fetchContent).toHaveBeenCalledOnce();
  });

  it.each([1, 3])(
    "confirms deletion from page %i and returns to the first page with filters intact",
    async (page) => {
      const pending = deferred<void>();
      vi.mocked(deleteContent).mockReturnValueOnce(pending.promise);
      vi.mocked(fetchContents)
        .mockResolvedValueOnce({ items: [guide], total: 72 })
        .mockResolvedValueOnce({ items: [], total: 0 });
      renderPage(`/contents?page=${page}&title=Account`, [
        "contents.read",
        "contents.delete",
      ]);
      await screen.findByText(guide.title);
      const confirm = confirmDeletion();
      expect(deleteContent).not.toHaveBeenCalled();

      let completion: Promise<void> | undefined;
      act(() => {
        completion = confirm();
      });
      expect(deleteContent).toHaveBeenCalledExactlyOnceWith(guide.id);
      expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
      expect(fetchContents).toHaveBeenCalledOnce();
      await act(async () => {
        pending.resolve();
        await completion;
      });

      await waitFor(() =>
        expect(fetchContents).toHaveBeenLastCalledWith(
          { page: "1", title: "Account" },
          expect.any(AbortSignal),
        ),
      );
      expect(screen.getByLabelText("Current location")).toHaveTextContent(
        "/contents?page=1&title=Account",
      );
      expect(screen.queryByText(guide.title)).not.toBeInTheDocument();
      expect(messages.success).toHaveBeenCalledWith(i18n.t("deleted"));
    },
  );

  it("reports deletion failure, retains the row and permits retry", async () => {
    vi.mocked(deleteContent).mockRejectedValueOnce(
      new Error("Synthetic delete refused"),
    );
    renderPage("/contents", ["contents.read", "contents.delete"]);
    await screen.findByText(guide.title);
    const confirm = confirmDeletion();

    await act(async () => {
      await expect(confirm()).rejects.toThrow("Synthetic delete refused");
    });

    expect(messages.error).toHaveBeenCalledWith("Synthetic delete refused");
    expect(screen.getByText(guide.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
    expect(fetchContents).toHaveBeenCalledOnce();
    vi.mocked(deleteContent).mockResolvedValueOnce(undefined);
    await act(async () => {
      await confirm();
    });
    expect(deleteContent).toHaveBeenCalledTimes(2);
    expect(fetchContents).toHaveBeenCalledTimes(2);
  });

  it("keeps the content list usable if fetching category options fails", async () => {
    vi.mocked(fetchContentCategories).mockRejectedValueOnce(
      new Error("Synthetic categories unavailable"),
    );
    renderPage();

    expect(await screen.findByText(guide.title)).toBeInTheDocument();
    expect(messages.error).toHaveBeenCalledExactlyOnceWith(
      "Synthetic categories unavailable",
    );
  });

  it("reports a current list failure and ignores abandoned list and category results", async () => {
    vi.mocked(fetchContents).mockRejectedValueOnce(
      new Error("Synthetic content unavailable"),
    );
    const first = renderPage();
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Synthetic content unavailable",
      ),
    );
    first.unmount();

    const pendingContents = deferred<{ items: Content[]; total: number }>();
    const pendingCategories = deferred<(typeof category)[]>();
    vi.mocked(fetchContents).mockReturnValueOnce(pendingContents.promise);
    vi.mocked(fetchContentCategories).mockReturnValueOnce(
      pendingCategories.promise,
    );
    const second = renderPage();
    const listSignal = vi.mocked(fetchContents).mock.calls[1][1];
    const categorySignal = vi.mocked(fetchContentCategories).mock.calls[1][0];
    second.unmount();

    expect(listSignal?.aborted).toBe(true);
    expect(categorySignal?.aborted).toBe(true);
    await act(async () => {
      pendingContents.reject(new Error("Obsolete listing"));
      pendingCategories.resolve([category]);
    });
    expect(messages.error).toHaveBeenCalledExactlyOnceWith(
      "Synthetic content unavailable",
    );
  });
});
