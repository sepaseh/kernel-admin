import { http, HttpResponse } from "msw/http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { login, register } from "../../features/auth/api.ts";
import { uploadFile } from "../../features/settings/components/logo-upload/api.ts";
import { server } from "../../test/mocks/server.ts";
import { i18nInstance } from "../i18n/index.ts";
import { apiClient, setUnauthorizedHandler } from "./client.ts";
import {
  clearAccessToken,
  getAccessToken,
  getAccessTokenVersion,
  setAccessToken,
} from "./token.ts";

afterEach(() => {
  clearAccessToken();
  setUnauthorizedHandler(null);
});

describe("HTTP payload boundaries", () => {
  it.each(["post", "put", "patch"] as const)(
    "sends snake-case JSON and returns camel-case data for %s",
    async (method) => {
      server.use(
        http[method]("http://localhost/transport", async ({ request }) => {
          expect(await request.json()).toEqual({
            display_name: "Ada",
            nested_items: [{ user_id: "u1" }],
          });
          return HttpResponse.json({
            record_id: "r1",
            nested_value: { first_name: "Ada" },
          });
        }),
      );
      await expect(
        apiClient[method]("/transport", {
          displayName: "Ada",
          nestedItems: [{ userId: "u1" }],
        }),
      ).resolves.toEqual({ recordId: "r1", nestedValue: { firstName: "Ada" } });
    },
  );

  it("keeps multipart file bytes and visibility without converting field names or overriding the boundary", async () => {
    const file = new File([Uint8Array.of(0, 17, 255)], "logo.bin", {
      type: "application/octet-stream",
    });
    server.use(
      http.post("http://localhost/files", async ({ request }) => {
        expect(request.headers.get("content-type")).toMatch(
          /^multipart\/form-data; boundary=/,
        );
        const data = await request.formData();
        const received = data.get("file");
        expect(received).toBeInstanceOf(File);
        expect(new Uint8Array(await (received as File).arrayBuffer())).toEqual(
          Uint8Array.of(0, 17, 255),
        );
        expect(data.get("visibility")).toBe("public");
        return HttpResponse.json({
          id: "file1",
          content_type: file.type,
          visibility: "public",
        });
      }),
    );
    await expect(uploadFile(file, "public")).resolves.toEqual({
      id: "file1",
      contentType: file.type,
      visibility: "public",
    });
  });

  it("returns binary bytes and accepts an empty delete response", async () => {
    server.use(
      http.delete(
        "http://localhost/transport",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const binary = new Blob([Uint8Array.of(0, 17, 255)], {
      type: "application/octet-stream",
    });
    const received = await apiClient.blob("/download", {
      adapter: async (config) => {
        expect(config.responseType).toBe("blob");
        return {
          config,
          data: binary,
          headers: {},
          status: 200,
          statusText: "OK",
        };
      },
    });
    expect(received).toBe(binary);
    expect(new Uint8Array(await received.arrayBuffer())).toEqual(
      Uint8Array.of(0, 17, 255),
    );
    await expect(apiClient.del("/transport")).resolves.toBe("");
  });
});

describe("validated authentication replies", () => {
  it.each([
    null,
    [],
    {},
    { access_token: 42 },
    { access_token: "" },
    { access_token: "  " },
  ])(
    "does not mutate the current session on a malformed login or registration: %j",
    async (reply) => {
      server.use(
        http.post("http://localhost/auth/:operation", () =>
          HttpResponse.json(reply),
        ),
      );
      setAccessToken("current-session");
      const version = getAccessTokenVersion();
      await expect(
        login({ identifier: "ada", password: "synthetic-test-credential" }),
      ).rejects.toThrow(i18nInstance.t("unexpectedError"));
      await expect(
        register({
          firstName: "Ada",
          lastName: "Lovelace",
          mobile: "09120000000",
          otp: "123456",
          password: "synthetic-test-credential",
        }),
      ).rejects.toThrow(i18nInstance.t("unexpectedError"));
      expect(getAccessToken()).toBe("current-session");
      expect(getAccessTokenVersion()).toBe(version);
    },
  );

  it("keeps a malformed refresh retryable without clearing authentication or replaying a mutation", async () => {
    const unauthorized = vi.fn();
    let reads = 0;
    let refreshes = 0;
    setAccessToken("expired-session");
    setUnauthorizedHandler(unauthorized);
    const version = getAccessTokenVersion();
    server.use(
      http.get("http://localhost/token-data", ({ request }) => {
        reads++;
        return request.headers.get("authorization") === "Bearer valid-new-token"
          ? HttpResponse.json({ current: true })
          : HttpResponse.json({ message: "Expired" }, { status: 401 });
      }),
      http.post("http://localhost/auth/refresh-token", () =>
        HttpResponse.json(
          ++refreshes === 1
            ? { access_token: 42 }
            : { access_token: "valid-new-token" },
        ),
      ),
    );
    await expect(apiClient.get("/token-data")).rejects.toThrow(
      i18nInstance.t("unexpectedError"),
    );
    expect(reads).toBe(1);
    expect(getAccessToken()).toBe("expired-session");
    expect(getAccessTokenVersion()).toBe(version);
    expect(unauthorized).not.toHaveBeenCalled();
    await expect(apiClient.get("/token-data")).resolves.toEqual({
      current: true,
    });
    expect(refreshes).toBe(2);
    expect(reads).toBe(3);
    expect(getAccessToken()).toBe("valid-new-token");
    expect(getAccessTokenVersion()).toBe(version);
  });
});
