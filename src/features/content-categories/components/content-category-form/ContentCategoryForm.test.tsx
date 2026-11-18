import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { CanceledError } from "axios";
import {
  Link,
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import {
  createContentCategory,
  fetchContentCategory,
  updateContentCategory,
} from "../../api";
import type { ContentCategory } from "../../types";
import { ContentCategoryForm } from "./ContentCategoryForm";

const { messages } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../api", () => ({
  createContentCategory: vi.fn(),
  deleteContentCategory: vi.fn(),
  fetchContentCategories: vi.fn(),
  fetchContentCategory: vi.fn(),
  sortContentCategories: vi.fn(),
  updateContentCategory: vi.fn(),
}));

vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages }),
}));

const category: ContentCategory = { id: "guides", name: "Guides" };

const CategoryNavigation = () => {
  const { hash } = useLocation();
  return (
    <>
      <Link to="/content-categories#create">Open category form</Link>
      <output aria-label="Category form location">{hash}</output>
    </>
  );
};

const RoutedCategoryForm = ({
  id,
  onFinish,
}: {
  id?: ContentCategory["id"];
  onFinish: () => void;
}) => {
  const goBack = useGoBack();

  const handleFinish = () => {
    onFinish();
    goBack();
  };

  return (
    <ContentCategoryForm id={id} onClose={goBack} onFinish={handleFinish} />
  );
};

const renderForm = ({
  hash = "#create",
  id,
  permissions = ["content-categories.create", "content-categories.update"],
}: {
  hash?: string;
  id?: string;
  permissions?: CurrentUser["permissions"];
} = {}) => {
  const currentUser: CurrentUser = {
    firstName: "Ada",
    id: "synthetic-category-editor",
    isSystemAdmin: false,
    lastName: "Lovelace",
    mobile: "09120000000",
    permissions: ["content-categories.read", ...permissions],
    status: "active",
  };
  const onFinish = vi.fn();

  return {
    ...render(
      <MemoryRouter initialEntries={[`/content-categories${hash}`]}>
        <CategoryNavigation />
        <Routes>
          <Route element={<Outlet context={{ currentUser }} />}>
            <Route
              path="/content-categories"
              element={<RoutedCategoryForm id={id} onFinish={onFinish} />}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    ),
    onFinish,
  };
};

const formLocation = () => screen.getByLabelText("Category form location");
const nameField = () => screen.findByRole("textbox", { name: i18n.t("name") });
const submitButton = () =>
  screen.getByRole("button", { name: i18n.t("submit") });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(createContentCategory).mockResolvedValue(category);
  vi.mocked(fetchContentCategory).mockResolvedValue(category);
  vi.mocked(updateContentCategory).mockResolvedValue(category);
  await i18n.changeLanguage("en");
});

describe("content category form", () => {
  it("rejects a whitespace-only name and creates a category with the corrected value", async () => {
    const { onFinish, user } = renderForm();
    const field = await nameField();
    fireEvent.change(field, { target: { value: "   " } });
    await user.click(submitButton());

    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(createContentCategory).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: category.name } });
    await user.click(submitButton());

    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(createContentCategory).toHaveBeenCalledExactlyOnceWith(
      { name: category.name },
      expect.any(AbortSignal),
    );
    expect(updateContentCategory).not.toHaveBeenCalled();
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("contentSaved"),
    );
    await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
  });

  it("waits for details before allowing an edit of the requested category", async () => {
    const pending = deferred<ContentCategory>();
    vi.mocked(fetchContentCategory).mockReturnValue(pending.promise);
    const { onFinish, user } = renderForm({ hash: "#update", id: category.id });
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("update"),
    });
    const submit = within(drawer).getByRole("button", {
      name: i18n.t("submit"),
    });
    expect(submit).toBeDisabled();
    expect(updateContentCategory).not.toHaveBeenCalled();

    await act(async () => pending.resolve(category));
    const name = await nameField();
    expect(name).toHaveValue(category.name);
    expect(submit).toBeEnabled();
    fireEvent.change(name, { target: { value: "Getting started" } });
    await user.click(submit);

    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(fetchContentCategory).toHaveBeenCalledExactlyOnceWith(
      category.id,
      expect.any(AbortSignal),
    );
    expect(updateContentCategory).toHaveBeenCalledExactlyOnceWith(
      category.id,
      { name: "Getting started" },
      expect.any(AbortSignal),
    );
    expect(createContentCategory).not.toHaveBeenCalled();
    await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
  });

  it("preserves the draft after a failed save and allows correction and retry", async () => {
    vi.mocked(createContentCategory).mockRejectedValueOnce(
      new Error("Name already exists"),
    );
    const { onFinish, user } = renderForm();
    const field = await nameField();
    fireEvent.change(field, { target: { value: category.name } });
    await user.click(submitButton());

    await waitFor(() => {
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Name already exists",
      );
      expect(submitButton()).toBeEnabled();
    });
    expect(formLocation()).toHaveTextContent("#create");
    expect(field).toHaveValue(category.name);
    expect(onFinish).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "Documentation" } });
    await user.click(submitButton());
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(createContentCategory).toHaveBeenLastCalledWith(
      { name: "Documentation" },
      expect.any(AbortSignal),
    );
  });

  it("suppresses cancellation feedback and releases the save control", async () => {
    vi.mocked(createContentCategory).mockRejectedValueOnce(new CanceledError());
    const { onFinish, user } = renderForm();
    const field = await nameField();
    fireEvent.change(field, { target: { value: category.name } });
    await user.click(submitButton());

    await waitFor(() => {
      expect(createContentCategory).toHaveBeenCalledOnce();
      expect(submitButton()).toBeEnabled();
    });
    expect(field).toHaveValue(category.name);
    expect(messages.error).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("resets the draft when the closed create drawer is opened again", async () => {
    const { user } = renderForm();
    fireEvent.change(await nameField(), { target: { value: "Unsaved draft" } });
    await user.click(screen.getByRole("button", { name: i18n.t("cancel") }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("link", { name: "Open category form" }));
    expect(await nameField()).toHaveValue("");
    expect(createContentCategory).not.toHaveBeenCalled();
  });

  it.each(["#create", "#update"])(
    "returns readers from %s without fetching editor data",
    async (hash) => {
      renderForm({ hash, id: category.id, permissions: [] });

      await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(fetchContentCategory).not.toHaveBeenCalled();
      expect(createContentCategory).not.toHaveBeenCalled();
      expect(updateContentCategory).not.toHaveBeenCalled();
    },
  );

  it("returns to the list when the edit URL supplies no selected category", async () => {
    renderForm({ hash: "#update" });

    await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
    expect(fetchContentCategory).not.toHaveBeenCalled();
    expect(updateContentCategory).not.toHaveBeenCalled();
  });

  it("reports a failed detail read and returns to the list", async () => {
    vi.mocked(fetchContentCategory).mockRejectedValueOnce(
      new Error("Category is unavailable"),
    );
    renderForm({ hash: "#update", id: category.id });

    await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
    expect(messages.error).toHaveBeenCalledExactlyOnceWith(
      "Category is unavailable",
    );
    expect(updateContentCategory).not.toHaveBeenCalled();
  });

  it("cancels a pending detail read when the edit drawer is closed", async () => {
    const pending = deferred<ContentCategory>();
    vi.mocked(fetchContentCategory).mockReturnValueOnce(pending.promise);
    const { user } = renderForm({ hash: "#update", id: category.id });
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("update"),
    });
    const signal = vi.mocked(fetchContentCategory).mock.calls[0][1];

    await user.click(
      within(drawer).getByRole("button", { name: i18n.t("cancel") }),
    );
    await act(async () => pending.resolve(category));

    expect(formLocation()).toBeEmptyDOMElement();
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByDisplayValue(category.name)).not.toBeInTheDocument();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"])(
    "blocks duplicate saves and ignores a late %s after unmount",
    async (outcome) => {
      const pending = deferred<ContentCategory>();
      vi.mocked(createContentCategory).mockReturnValueOnce(pending.promise);
      const { onFinish, unmount, user } = renderForm();
      const name = await nameField();
      const submit = submitButton();
      fireEvent.change(name, { target: { value: category.name } });
      await user.click(submit);
      await waitFor(() => expect(submit).toBeDisabled());
      expect(name).toBeDisabled();
      await user.click(submit);
      expect(createContentCategory).toHaveBeenCalledOnce();
      const signal = vi.mocked(createContentCategory).mock.calls[0][1];
      unmount();

      await act(async () => {
        if (outcome === "success") pending.resolve(category);
        else pending.reject(new Error("Obsolete save response"));
      });

      expect(signal?.aborted).toBe(true);
      expect(messages.success).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
    },
  );
});
