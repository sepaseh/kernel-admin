import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../../shared/api/index.ts";
import { uploadFile } from "./api.ts";

vi.mock("../../../../shared/api/index.ts", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe("settings file upload", () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it("uploads the selected file with its visibility", async () => {
    const file = new File(["logo"], "logo.svg", {
      type: "image/svg+xml",
    });
    const response = {
      contentType: "image/svg+xml",
      id: "file-1",
      url: "http://localhost:5173/logo.svg",
      visibility: "public" as const,
    };
    vi.mocked(apiClient.post).mockResolvedValue(response);

    await expect(uploadFile(file, "public")).resolves.toEqual(response);

    const [path, body, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(path).toBe("/files");
    expect(config?.timeout).toBe(60_000);
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBe(file);
    expect((body as FormData).get("visibility")).toBe("public");
  });

  it("forwards optional cancellation while preserving the upload deadline and body", async () => {
    const controller = new AbortController();
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    vi.mocked(apiClient.post).mockResolvedValue({
      contentType: "image/png",
      id: "logo-1",
      visibility: "public",
    });
    await uploadFile(file, "public", controller.signal);
    const [path, body, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(path).toBe("/files");
    expect(config).toEqual({ signal: controller.signal, timeout: 60_000 });
    expect((body as FormData).get("file")).toBe(file);
    expect((body as FormData).get("visibility")).toBe("public");
  });
});
