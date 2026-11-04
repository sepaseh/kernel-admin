import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateProductionEnv } from "./validate-production-env.mjs";

const valid = {
  VITE_API_BASE_URL: "http://api.example.com",
  VITE_APP_BASE_URL: "/app/",
};

describe("production environment validation", () => {
  it("synthetic CLI validation ignores dotenv fallback and requires explicit build values", async () => {
    const parent = path.resolve(tmpdir());
    const directory = await mkdtemp(
      path.join(parent, "kernel-production-env-test-"),
    );
    const resolved = path.resolve(directory);
    if (
      path.dirname(resolved) !== parent ||
      !path.basename(resolved).startsWith("kernel-production-env-test-")
    )
      throw new Error("Unexpected test fixture cleanup path");
    try {
      await writeFile(
        path.join(directory, ".env.production"),
        "VITE_API_BASE_URL=http://dotenv-must-not-be-used.test\nVITE_APP_BASE_URL=/\n",
      );
      const env = {
        KERNEL_SYNTHETIC_ENV: "1",
        ...(process.env.SystemRoot
          ? { SystemRoot: process.env.SystemRoot }
          : {}),
        ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
        ...(process.env.TMP ? { TMP: process.env.TMP } : {}),
      };
      const args = [
        fileURLToPath(
          new URL("./validate-production-env.mjs", import.meta.url),
        ),
      ];
      const missing = spawnSync(process.execPath, args, {
        cwd: directory,
        env,
        encoding: "utf8",
        windowsHide: true,
      });
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain("VITE_API_BASE_URL is required");
      const explicit = spawnSync(process.execPath, args, {
        cwd: directory,
        env: { ...env, ...valid },
        encoding: "utf8",
        windowsHide: true,
      });
      expect(explicit.status).toBe(0);
    } finally {
      await rm(resolved, { recursive: true, force: true });
    }
  });

  it("accepts valid required and optional URLs", () => {
    expect(() =>
      validateProductionEnv({
        ...valid,
        VITE_OBSERVABILITY_URL: "http://events.example.com/collect",
      }),
    ).not.toThrow();
  });

  it.each([
    [{ VITE_APP_BASE_URL: "/" }, "VITE_API_BASE_URL is required"],
    [{ ...valid, VITE_API_BASE_URL: "invalid" }, "valid absolute URL"],
    [{ ...valid, VITE_APP_BASE_URL: "app/" }, "must start and end with /"],
    [{ ...valid, VITE_APP_BASE_URL: "" }, "must start and end with /"],
    [{ ...valid, VITE_APP_BASE_URL: "/app" }, "must start and end with /"],
    [
      { ...valid, VITE_OBSERVABILITY_URL: "invalid" },
      "OBSERVABILITY_URL must be a valid",
    ],
  ])("rejects invalid configuration", (env, message) => {
    expect(() => validateProductionEnv(env)).toThrow(message);
  });

  for (const name of ["VITE_API_BASE_URL", "VITE_OBSERVABILITY_URL"])
    it.each([
      "ftp://example.com",
      "file:///synthetic",
      "javascript:alert(1)",
      "https://user:pass@example.com",
    ])(`rejects unsafe ${name} %s`, (url) =>
      expect(() => validateProductionEnv({ ...valid, [name]: url })).toThrow(),
    );

  it.each(["//outside.example/", "/\\outside.example/"])(
    "rejects an escaping application base path %s",
    (basePath) =>
      expect(() =>
        validateProductionEnv({ ...valid, VITE_APP_BASE_URL: basePath }),
      ).toThrow(/canonical URL segments/),
  );
});
