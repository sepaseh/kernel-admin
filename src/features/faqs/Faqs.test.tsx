import { act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import {
  createFaq,
  deleteFaq,
  fetchFaq,
  fetchFaqs,
  sortFaqs,
  updateFaq,
} from "./api";
import { FaqsPage } from "./Faqs";
import type { Faq } from "./types";

const { confirm, messages } = vi.hoisted(() => ({
  confirm: vi.fn<(options: { onOk: () => Promise<void> }) => void>(),
  messages: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("./api", () => ({
  createFaq: vi.fn(),
  deleteFaq: vi.fn(),
  fetchFaq: vi.fn(),
  fetchFaqs: vi.fn(),
  sortFaqs: vi.fn(),
  updateFaq: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, modalAPI: { confirm } }),
}));

const first: Faq = {
  id: "faq-1",
  question: "Where can I find my files?",
  answer: "Open the Files page.",
};
const second: Faq = {
  id: "faq-2",
  question: "How do I edit a category?",
  answer: "Open the Category settings.",
};

const LocationPreview = () => {
  const { hash, pathname, search } = useLocation();
  return <output aria-label="FAQ location">{pathname + search + hash}</output>;
};

const renderPage = (
  permissions: CurrentUser["permissions"] = ["faqs.read"],
) => {
  const currentUser: CurrentUser = {
    firstName: "Ada",
    id: "synthetic-operator",
    isSystemAdmin: false,
    lastName: "Lovelace",
    mobile: "09120000000",
    permissions,
    status: "active",
  };
  return render(
    <MemoryRouter initialEntries={["/faqs?from=admin"]}>
      <LocationPreview />
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route path="/faqs" element={<FaqsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

const getConfirmation = () => {
  const [confirmation] = confirm.mock.lastCall ?? [];
  if (!confirmation) throw new Error("Expected an FAQ deletion confirmation");

  return confirmation;
};

const questionOrder = () =>
  screen
    .getAllByRole("cell", { name: /^(Where can I find|How do I edit)/ })
    .map((cell) => cell.textContent);

const provideRowGeometry = () => {
  // jsdom has no layout. Give the keyboard sensor distinct sortable row bounds.
  const getBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const row = this.closest("tr[data-row-key]");
      const index = [first, second].findIndex(
        (faq) => faq.id === row?.getAttribute("data-row-key"),
      );
      return index < 0
        ? getBoundingClientRect.call(this)
        : new DOMRect(16, 48 + index * 48, 320, 48);
    },
  );
};

const reorderFirst = async (user: ReturnType<typeof render>["user"]) => {
  const handle = screen.getAllByRole("button", { name: i18n.t("order") })[0];
  handle.focus();
  await user.keyboard("[Space]");
  await waitFor(() => expect(handle).toHaveAttribute("aria-pressed", "true"));
  await user.keyboard("[ArrowDown]");
  await waitFor(() =>
    expect(screen.getByText(/moved over droppable area faq-2/i)).toBeVisible(),
  );
  await user.keyboard("[Space]");
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchFaqs).mockResolvedValue([first, second]);
  vi.mocked(fetchFaq).mockImplementation(async (id) => {
    const result = [first, second].find((faq) => faq.id === id);
    if (!result) throw new Error(`Unknown synthetic FAQ: ${id}`);

    return result;
  });
  vi.mocked(createFaq).mockResolvedValue(first);
  vi.mocked(updateFaq).mockResolvedValue(second);
  vi.mocked(deleteFaq).mockResolvedValue(undefined);
  vi.mocked(sortFaqs).mockResolvedValue(undefined);
  await i18n.changeLanguage("en");
});

describe("FAQ listing", () => {
  it("shows questions and expanded answers to a read-only operator", async () => {
    renderPage();
    const firstRow = await screen.findByRole("row", {
      name: new RegExp(first.question.replace("?", "\\?")),
    });
    expect(within(firstRow).getByRole("cell", { name: "1" })).toBeVisible();
    expect(screen.getByText(first.answer)).toBeVisible();
    expect(screen.getByText(second.answer)).toBeVisible();
    expect(questionOrder()).toEqual([first.question, second.question]);
    expect(fetchFaqs).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
    for (const action of ["create", "update", "delete", "order"] as const)
      expect(
        screen.queryByRole("button", { name: i18n.t(action) }),
      ).not.toBeInTheDocument();
  });

  it("opens and closes creation without losing the current query", async () => {
    const { user } = renderPage(["faqs.read", "faqs.create"]);
    await screen.findByText(first.question);

    await user.click(screen.getByRole("button", { name: i18n.t("create") }));
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("create"),
    });
    expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
      "/faqs?from=admin#create",
    );
    expect(
      within(drawer).getByRole("textbox", { name: i18n.t("question") }),
    ).toHaveValue("");
    expect(fetchFaq).not.toHaveBeenCalled();

    await user.click(
      within(drawer).getByRole("button", { name: i18n.t("cancel") }),
    );
    await waitFor(() => expect(drawer).not.toBeVisible());
    expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
      /^\/faqs\?from=admin$/,
    );
    expect(createFaq).not.toHaveBeenCalled();
  });

  it("opens the selected FAQ for editing and retains the current query", async () => {
    const { user } = renderPage(["faqs.read", "faqs.update"]);
    const question = await screen.findByText(second.question);
    const row = question.closest("tr");
    if (!row) throw new Error("Expected an FAQ row");

    await user.click(
      within(row).getByRole("button", { name: i18n.t("update") }),
    );
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("update"),
    });
    expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
      "/faqs?from=admin#update",
    );
    expect(
      await within(drawer).findByDisplayValue(second.question),
    ).toBeVisible();
    expect(within(drawer).getByDisplayValue(second.answer)).toBeVisible();
    expect(fetchFaq).toHaveBeenCalledExactlyOnceWith(
      second.id,
      expect.any(AbortSignal),
    );
  });

  it("waits for a confirmed deletion before refreshing the list", async () => {
    const pending = deferred<void>();
    vi.mocked(deleteFaq).mockReturnValueOnce(pending.promise);
    vi.mocked(fetchFaqs)
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([second]);
    const { user } = renderPage(["faqs.read", "faqs.delete"]);
    const button = (
      await screen.findAllByRole("button", { name: i18n.t("delete") })
    )[0];
    await user.click(button);
    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: i18n.t("deleteConfirm") }),
    );
    expect(deleteFaq).not.toHaveBeenCalled();

    let deletion!: Promise<void>;
    act(() => {
      deletion = getConfirmation().onOk();
    });
    expect(deleteFaq).toHaveBeenCalledExactlyOnceWith(first.id);
    expect(fetchFaqs).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await act(async () => {
      pending.resolve();
      await deletion;
    });
    expect(fetchFaqs).toHaveBeenCalledTimes(2);
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(i18n.t("deleted"));
    expect(screen.queryByText(first.question)).not.toBeInTheDocument();
    expect(screen.getByText(second.question)).toBeVisible();
  });

  it("reports failed deletion and preserves the existing list for retry", async () => {
    const failure = new Error("Synthetic FAQ deletion failed");
    vi.mocked(deleteFaq).mockRejectedValueOnce(failure);
    const { user } = renderPage(["faqs.read", "faqs.delete"]);
    const button = (
      await screen.findAllByRole("button", { name: i18n.t("delete") })
    )[0];
    await user.click(button);
    await act(async () => {
      await expect(getConfirmation().onOk()).rejects.toBe(failure);
    });

    expect(messages.error).toHaveBeenCalledExactlyOnceWith(failure.message);
    expect(messages.success).not.toHaveBeenCalled();
    expect(fetchFaqs).toHaveBeenCalledTimes(1);
    expect(screen.getByText(first.question)).toBeVisible();
    expect(button).toBeEnabled();

    await user.click(button);
    await act(async () => {
      await getConfirmation().onOk();
    });
    expect(deleteFaq).toHaveBeenNthCalledWith(2, first.id);
    expect(fetchFaqs).toHaveBeenCalledTimes(2);
  });

  it("preserves the accepted order after a failed save and reloads a successful retry", async () => {
    provideRowGeometry();
    const failure = new Error("Synthetic FAQ order save failed");
    vi.mocked(sortFaqs).mockRejectedValueOnce(failure);
    vi.mocked(fetchFaqs)
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([second, first]);
    const { user } = renderPage(["faqs.read", "faqs.update"]);
    await screen.findByText(first.question);

    await reorderFirst(user);
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(failure.message),
    );
    expect(sortFaqs).toHaveBeenCalledExactlyOnceWith({
      ids: [second.id, first.id],
    });
    expect(fetchFaqs).toHaveBeenCalledTimes(1);
    expect(questionOrder()).toEqual([first.question, second.question]);

    await reorderFirst(user);
    await waitFor(() =>
      expect(questionOrder()).toEqual([second.question, first.question]),
    );
    expect(sortFaqs).toHaveBeenNthCalledWith(2, { ids: [second.id, first.id] });
    expect(fetchFaqs).toHaveBeenCalledTimes(2);
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("contentSaved"),
    );
  });

  it("reports an active list read failure", async () => {
    vi.mocked(fetchFaqs).mockRejectedValueOnce(
      new Error("Synthetic FAQs unavailable"),
    );
    renderPage();
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Synthetic FAQs unavailable",
      ),
    );
    expect(screen.queryByText(first.question)).not.toBeInTheDocument();
  });

  it("aborts an abandoned list read and suppresses its late failure", async () => {
    const pending = deferred<Faq[]>();
    vi.mocked(fetchFaqs).mockReturnValueOnce(pending.promise);
    const { unmount } = renderPage();
    const signal = vi.mocked(fetchFaqs).mock.calls[0][0]!;
    unmount();

    await act(async () => pending.reject(new Error("Synthetic obsolete read")));
    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });
});
