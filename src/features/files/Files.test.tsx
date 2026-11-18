import { act, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import { deleteFile, fetchFiles } from "./api";
import { FilesPage } from "./Files";
import type { StoredFile } from "./types";

const { confirm, messages } = vi.hoisted(() => ({
  confirm: vi.fn<(options: { onOk: () => Promise<void> }) => void>(),
  messages: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("./api", () => ({
  deleteFile: vi.fn(),
  fetchFiles: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({
    messageAPI: messages,
    modalAPI: { confirm },
    token: { colorError: "red", colorSuccess: "green" },
  }),
}));

const unusedFile: StoredFile = {
  id: "unused-file",
  isUsed: false,
  size: 12,
  url: "https://example.invalid/unused-file",
};
const usedFile: StoredFile = {
  id: "used-file",
  isUsed: true,
  size: 24,
  url: "https://example.invalid/used-file",
};

const renderPage = (permissions: CurrentUser["permissions"]) => {
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
    <MemoryRouter initialEntries={["/files"]}>
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route path="/files" element={<FilesPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

const getConfirmation = () => {
  const [confirmation] = confirm.mock.lastCall ?? [];
  if (!confirmation) throw new Error("Expected a file deletion confirmation");

  return confirmation;
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchFiles).mockResolvedValue([unusedFile, usedFile]);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("files listing", () => {
  it("shows file usage and hides deletion for a read-only operator", async () => {
    renderPage(["files.read"]);

    await screen.findByText(unusedFile.id);
    expect(fetchFiles).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
    expect(screen.getByRole("img", { name: i18n.t("fileUsed") })).toBeVisible();
    expect(
      screen.getByRole("img", { name: i18n.t("fileUnused") }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: i18n.t("delete") }),
    ).not.toBeInTheDocument();
  });

  it("disables deletion for in-use files and reloads the list after a confirmed delete", async () => {
    const pendingDelete = deferred<void>();
    vi.mocked(deleteFile).mockReturnValue(pendingDelete.promise);
    vi.mocked(fetchFiles)
      .mockResolvedValueOnce([unusedFile, usedFile])
      .mockResolvedValueOnce([usedFile]);
    const { user } = renderPage(["files.read", "files.delete"]);

    const usedRow = await screen.findByRole("row", { name: /^used-file\b/ });
    const unusedRow = screen.getByRole("row", { name: /^unused-file\b/ });
    const usedDelete = within(usedRow).getByRole("button", {
      name: i18n.t("delete"),
    });
    const unusedDelete = within(unusedRow).getByRole("button", {
      name: i18n.t("delete"),
    });
    expect(usedDelete).toBeDisabled();
    await user.click(usedDelete);
    expect(confirm).not.toHaveBeenCalled();
    await user.click(unusedDelete);
    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: i18n.t("deleteConfirm") }),
    );
    expect(deleteFile).not.toHaveBeenCalled();

    let deletion!: Promise<void>;
    act(() => {
      deletion = getConfirmation().onOk();
    });
    expect(deleteFile).toHaveBeenCalledExactlyOnceWith(unusedFile.id);
    expect(fetchFiles).toHaveBeenCalledTimes(1);
    expect(unusedDelete).toBeDisabled();

    await act(async () => {
      pendingDelete.resolve();
      await deletion;
    });

    expect(fetchFiles).toHaveBeenCalledTimes(2);
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(i18n.t("deleted"));
    expect(screen.queryByText(unusedFile.id)).not.toBeInTheDocument();
    expect(screen.getByText(usedFile.id)).toBeVisible();
  });

  it("reports a failed deletion, keeps the file, and permits a retry", async () => {
    const error = new Error("Synthetic file deletion failed");
    vi.mocked(deleteFile)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);
    const { user } = renderPage(["files.read", "files.delete"]);

    const row = await screen.findByRole("row", { name: /^unused-file\b/ });
    const deleteButton = within(row).getByRole("button", {
      name: i18n.t("delete"),
    });
    await user.click(deleteButton);
    const { onOk } = getConfirmation();
    await act(async () => {
      await expect(onOk()).rejects.toBe(error);
    });

    expect(messages.error).toHaveBeenCalledExactlyOnceWith(error.message);
    expect(messages.success).not.toHaveBeenCalled();
    expect(fetchFiles).toHaveBeenCalledTimes(1);
    expect(screen.getByText(unusedFile.id)).toBeVisible();
    expect(deleteButton).toBeEnabled();

    await act(async () => {
      await onOk();
    });

    expect(deleteFile).toHaveBeenNthCalledWith(2, unusedFile.id);
    expect(fetchFiles).toHaveBeenCalledTimes(2);
  });
});
