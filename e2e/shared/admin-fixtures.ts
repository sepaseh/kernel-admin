import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";

import type { PermissionKey } from "@/features/roles";
import { catalogs } from "@/shared/i18n/catalogs";

import { applicationSettingsFixture } from "../fixtures";

type AdminFixtureOptions = {
  baseURL: string;
  language: "en" | "fa";
  legacySecondUser?: boolean;
  theme: "light" | "dark";
  permissions?: PermissionKey[];
};

export const test = base.extend<{ networkGuard: void }>({
  networkGuard: [
    async ({ baseURL, context }, use) => {
      if (!baseURL)
        throw new Error("An owned application base URL is required.");
      const origin = new URL(baseURL);
      if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1")
        throw new Error(
          "Application browser fixtures require an owned loopback origin.",
        );

      const unexpectedRequests: string[] = [];
      await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === origin.origin)
          return route.continue();

        unexpectedRequests.push(route.request().url());
        return route.abort("blockedbyclient");
      });
      await use();
      expect(
        unexpectedRequests,
        "Every external request needs an explicit synthetic handler",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

const adminFixtureUser = {
  email: "ada@example.com",
  first_name: "Ada",
  id: "user-1",
  is_system_admin: false,
  last_name: "Lovelace",
  mobile: "09121111111",
  roles: [],
  status: "active",
  username: "ada",
} as const;

/** Route every browser API call to explicit synthetic data; no real backend. */
export const setupAdminFixture = async (
  page: Page,
  {
    baseURL,
    language,
    legacySecondUser = false,
    theme,
    permissions = ["users.read", "roles.read", "roles.create"],
  }: AdminFixtureOptions,
) => {
  const appOrigin = new URL(baseURL).origin;
  const messages = catalogs[language];
  const unexpectedRequests: string[] = [];
  const requests: string[] = [];
  await page.addInitScript(
    ({ theme }) => {
      localStorage.setItem("theme", theme);
    },
    { theme },
  );
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) return route.continue();
    if (url.origin !== "https://api.example.com") {
      unexpectedRequests.push(request.url());
      return route.abort();
    }
    requests.push(`${request.method()} ${url.pathname}`);
    if (request.method() === "GET") {
      if (url.pathname === "/settings")
        return route.fulfill({
          json: applicationSettingsFixture(language),
        });
      if (url.pathname === "/account/me")
        return route.fulfill({
          json: {
            email: "manager@example.com",
            first_name: "Test",
            id: "manager-1",
            is_system_admin: false,
            last_name: "Manager",
            mobile: "09120000000",
            permissions,
            status: "active",
            username: "manager",
          },
        });
      if (url.pathname === "/users") {
        const items = legacySecondUser
          ? [
              adminFixtureUser,
              {
                ...adminFixtureUser,
                email: "grace@example.com",
                first_name: "Grace",
                id: "user-2",
                last_name: "Hopper",
                mobile: "09121111112",
                status: "inactive",
                username: "grace",
              },
            ]
          : [adminFixtureUser];
        return route.fulfill({ json: { items, total: items.length } });
      }
      if (url.pathname === "/roles") return route.fulfill({ json: [] });
      if (url.pathname === "/roles/permissions")
        return route.fulfill({
          json: [
            {
              name: "users",
              title: messages.users,
              permissions: [
                { name: "users.read", title: messages.users },
                {
                  name: "users.update",
                  title: `${messages.update} ${messages.users}`,
                },
              ],
            },
          ],
        });
    }
    unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected synthetic API request" },
    });
  });
  return { messages, requests, unexpectedRequests };
};
