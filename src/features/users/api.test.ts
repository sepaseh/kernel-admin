import { http, HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import { i18nInstance } from "../../shared/i18n/index.ts";
import { server } from "../../test/mocks/server.ts";
import { fetchUser, fetchUsers } from "./api.ts";

vi.mock("../../shared/i18n/index.ts", () => ({
  i18nInstance: { t: (key: string) => key },
}));

describe("users API", () => {
  it.each([
    ["member/#? 1", "member%2F%23%3F%201"],
    ["عضو آبی", "%D8%B9%D8%B6%D9%88%20%D8%A2%D8%A8%DB%8C"],
    ["encoded%2Fid", "encoded%252Fid"],
  ])("sends the opaque ID %s as one HTTP path segment", async (id, segment) => {
    server.use(
      http.get("http://localhost/users/:id", ({ params, request }) => {
        const url = new URL(request.url);
        expect(url.pathname).toBe(`/users/${segment}`);
        expect(url.search).toBe("");
        expect(url.hash).toBe("");
        expect(params.id).toBe(id);

        return HttpResponse.json({
          id,
          first_name: "Ada",
          is_system_admin: false,
          last_name: "Lovelace",
          mobile: "09120000000",
          roles: [],
          status: "active",
        });
      }),
    );

    const controller = new AbortController();
    await expect(fetchUser(id, controller.signal)).resolves.toMatchObject({
      id,
      firstName: "Ada",
    });
  });

  it("serializes filters and converts the response to camel case", async () => {
    server.use(
      http.get("http://localhost/users", ({ request }) => {
        const url = new URL(request.url);

        expect(url.searchParams.get("offset")).toBe("12");
        expect(url.searchParams.get("size")).toBe("12");
        expect(url.searchParams.get("first_name")).toBe("Ada");
        expect(url.searchParams.get("last_name")).toBe("Lovelace");

        return HttpResponse.json({
          items: [
            {
              email: null,
              first_name: "Ada",
              id: "user-1",
              is_system_admin: false,
              last_name: "Lovelace",
              mobile: "09120000000",
              roles: [{ id: "role-1", name: "Operators" }],
              status: "active",
              username: "ada",
            },
          ],
          total: 1,
        });
      }),
    );

    await expect(
      fetchUsers({
        firstName: "Ada",
        lastName: "Lovelace",
        offset: "12",
        size: "12",
      }),
    ).resolves.toEqual({
      items: [
        {
          firstName: "Ada",
          id: "user-1",
          isSystemAdmin: false,
          lastName: "Lovelace",
          mobile: "09120000000",
          roles: [{ id: "role-1", name: "Operators" }],
          status: "active",
          username: "ada",
        },
      ],
      total: 1,
    });
  });

  it("localizes network errors", async () => {
    server.use(http.get("http://localhost/users", () => HttpResponse.error()));

    await expect(fetchUsers({})).rejects.toThrow(
      i18nInstance.t("networkError"),
    );
  });

  it("localizes unexpected API responses", async () => {
    server.use(
      http.get("http://localhost/users", () =>
        HttpResponse.json(null, { status: 500 }),
      ),
    );

    await expect(fetchUsers({})).rejects.toThrow(
      i18nInstance.t("unexpectedError"),
    );
  });
});
