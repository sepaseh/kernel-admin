import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";

import { deleteFile, uploadFile } from "./api";

const { del, upload } = vi.hoisted(() => ({ del: vi.fn(), upload: vi.fn() }));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: {
    del,
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload,
  },
}));
beforeEach(() => {
  del.mockReset();
  upload.mockReset();
});

it("keeps a file identifier inside one encoded URI segment", async () => {
  const controller = new AbortController();
  await deleteFile("a/b?c#d%20", controller.signal);

  expect(del).toHaveBeenCalledWith("/files/a%2Fb%3Fc%23d%2520", {
    signal: controller.signal,
  });
});

it("keeps upload cancellation, progress and file context together", async () => {
  const controller = new AbortController();
  const file = new File(["synthetic-image"], "synthetic.png", {
    type: "image/png",
  });
  const onUploadProgress = vi.fn();
  const storedFile = {
    id: "synthetic-upload",
    isUsed: false,
    size: file.size,
    url: "https://example.invalid/synthetic.png",
  };
  upload.mockResolvedValue(storedFile);

  await expect(
    uploadFile(file, "contents", onUploadProgress, controller.signal),
  ).resolves.toBe(storedFile);
  expect(upload).toHaveBeenCalledWith(
    "/files",
    { context: "contents", file },
    { onUploadProgress, signal: controller.signal },
  );
});

it.each(["", ".", ".."])(
  "rejects an unsafe file identifier (%j) before sending a request",
  (id) => {
    expect(() => deleteFile(id)).toThrow();
    expect(del).not.toHaveBeenCalled();
  },
);
