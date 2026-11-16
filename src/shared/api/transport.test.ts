// @vitest-environment node
import axios, { isCancel } from "axios";
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { deferred } from "@/test/deferred";

const originalEnv = axios.defaults.env;
// The Node build otherwise selects its legacy form-data constructor. Use the
// native File/FormData API supplied by browsers while keeping real HTTP encoding.
axios.defaults.env = { ...originalEnv, FormData };
const { uploadFile } = await import("@/features/files/api");
const { setUnauthorizedHandler } = await import("./client");
const { clearAccessToken, getAccessToken, setAccessToken } =
  await import("./token");
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  clearAccessToken();
  setUnauthorizedHandler(null);
});
afterAll(() => {
  server.close();
  axios.defaults.env = originalEnv;
});

describe("multipart HTTP boundary", () => {
  it("keeps file bytes and context with an actual generated multipart boundary", async () => {
    const file = new File([Uint8Array.of(0, 17, 255)], "synthetic.bin", {
      type: "application/octet-stream",
    });
    server.use(
      http.post("http://localhost/files", async ({ request }) => {
        expect(request.headers.get("content-type")).toMatch(
          /^multipart\/form-data;\s*boundary=.+/,
        );
        const data = await request.formData();
        expect([...data.keys()].sort()).toEqual(["context", "file"]);
        expect(data.get("context")).toBe("contents");
        const received = data.get("file");
        if (received === null || typeof received === "string")
          throw new Error("Expected the serialized upload to contain a file");

        expect(received.name).toBe(file.name);
        expect(received.type).toBe(file.type);
        expect(new Uint8Array(await received.arrayBuffer())).toEqual(
          Uint8Array.of(0, 17, 255),
        );
        return HttpResponse.json({
          id: "file-wire",
          is_used: false,
          size: file.size,
          url: "/synthetic.bin",
        });
      }),
    );

    await expect(uploadFile(file, "contents")).resolves.toEqual({
      id: "file-wire",
      isUsed: false,
      size: file.size,
      url: "/synthetic.bin",
    });
  });

  it.each(["caller", "session"] as const)(
    "cancels a pending serialized upload when its %s becomes obsolete",
    async (scope) => {
      const entered = deferred<void>();
      const release = deferred<void>();
      const returned = deferred<void>();
      let requestEntered = false;
      server.use(
        http.post("http://localhost/files", async () => {
          requestEntered = true;
          entered.resolve();
          try {
            await release.promise;
            return HttpResponse.json({
              id: "late-file",
              is_used: false,
              size: 1,
              url: "/late.bin",
            });
          } finally {
            returned.resolve();
          }
        }),
      );
      const controller = new AbortController();
      setAccessToken("synthetic-old-session");
      const pending = uploadFile(
        new File(["x"], "late.bin"),
        "contents",
        undefined,
        controller.signal,
      );
      const settled = pending.catch((error: unknown) => error);

      try {
        await Promise.race([entered.promise, pending]);
        if (scope === "caller") controller.abort();
        else setAccessToken("synthetic-new-session");
        release.resolve();

        expect(isCancel(await settled)).toBe(true);
        expect(getAccessToken()).toBe(
          scope === "caller"
            ? "synthetic-old-session"
            : "synthetic-new-session",
        );
      } finally {
        release.resolve();
        await settled;
        if (requestEntered) await returned.promise;
      }
    },
  );
});
