import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/api";

import { fetchLanguages, fetchSettings, updateSettings } from "./api";
import type { SettingsRequest } from "./types";

vi.mock("@/shared/api", () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("settings HTTP contract", () => {
  it("forwards cancellation to settings and language metadata reads", async () => {
    const controller = new AbortController();
    await fetchSettings(controller.signal);
    await fetchLanguages(controller.signal);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/settings", {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/languages", {
      signal: controller.signal,
    });
  });

  it("persists palettes, image limits, API language and uploaded logo identifiers together", async () => {
    const colors = {
      colorBgBase: "#fff",
      colorBgContainer: "#fff",
      colorBorder: "#ccc",
      colorLink: "#05a",
      colorPrimary: "#05a",
      colorTextBase: "#111",
      colorTextDescription: "#333",
    };
    const request: SettingsRequest = {
      darkTheme: colors,
      lightTheme: colors,
      imageSettings: {
        logo: { width: 100, height: 100, size: 1024 },
        contents: { width: 400, height: 200, size: 4096 },
      },
      languageCode: "fa",
      darkLogoId: "synthetic-dark",
      lightLogoId: "synthetic-light",
    };
    const response = {
      ...request,
      language: { code: "fa", calendar: "jalali", direction: "rtl" },
    };
    vi.mocked(apiClient.put).mockResolvedValue(response);
    const controller = new AbortController();

    await expect(updateSettings(request, controller.signal)).resolves.toBe(
      response,
    );
    expect(apiClient.put).toHaveBeenCalledWith("/settings", request, {
      signal: controller.signal,
    });
  });

  it("propagates a rejected settings read without substituting local settings", async () => {
    const error = new Error("Synthetic settings conflict");
    vi.mocked(apiClient.get).mockRejectedValue(error);

    await expect(fetchSettings()).rejects.toBe(error);
  });
});
