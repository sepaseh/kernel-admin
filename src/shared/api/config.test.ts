import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("public API endpoint configuration", () => {
  it("uses the explicit public API base independently of browser origin", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
    vi.stubGlobal("location", { origin: "https://panel.example.test" });
    vi.resetModules();
    expect((await import("./config.ts")).apiUrl).toBe(
      "https://api.example.test/",
    );
  });
  it("falls back to the browser's own origin when no API base is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    vi.stubGlobal("location", { origin: "https://panel.example.test" });
    vi.resetModules();
    expect((await import("./config.ts")).apiUrl).toBe(
      "https://panel.example.test",
    );
  });
});
