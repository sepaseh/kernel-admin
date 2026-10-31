import { catalogs } from "@/shared/i18n/catalogs";

import { applicationSettingsFixture, fixtureDirections } from "./fixtures";
import { expect, test } from "./shared/admin-fixtures";

for (const language of ["en", "fa"] as const) {
  const messages = catalogs[language];
  test(`Users reads recover without false empty states or discarded rows (${language})`, async ({
    baseURL,
    page,
  }, testInfo) => {
    const apiOrigin = "https://api.example.com";
    const localOrigin = new URL(baseURL!).origin;
    const unexpectedRequests: string[] = [];
    const listQueries: string[] = [];
    let statusUpdates = 0;
    const userRecord = {
      email: "ada@example.com",
      first_name: "Ada",
      id: "user-1",
      is_system_admin: false,
      last_name: "Lovelace",
      mobile: "09121111111",
      roles: [],
      status: "active",
      username: "ada",
    };
    await page.addInitScript(() => {
      localStorage.setItem("theme", "light");
    });
    // All API data is synthetic. Unexpected origins are blocked before network.
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === localOrigin) return route.continue();
      if (url.origin !== apiOrigin) {
        unexpectedRequests.push(request.url());
        return route.abort();
      }
      if (request.method() === "GET" && url.pathname === "/settings")
        return route.fulfill({
          json: applicationSettingsFixture(language),
        });
      if (request.method() === "GET" && url.pathname === "/account/me")
        return route.fulfill({
          json: {
            first_name: "Test",
            id: "manager-1",
            is_system_admin: false,
            last_name: "Manager",
            mobile: "09120000000",
            permissions: ["users.read", "users.update"],
            status: "active",
          },
        });
      if (request.method() === "GET" && url.pathname === "/roles")
        return route.fulfill({ json: [] });
      if (request.method() === "GET" && url.pathname === "/users") {
        listQueries.push(url.search);
        if (listQueries.length === 1 || listQueries.length === 3)
          return route.fulfill({
            status: 500,
            json: { message: messages.networkError },
          });
        return route.fulfill({ json: { items: [userRecord], total: 1 } });
      }
      if (
        request.method() === "PATCH" &&
        url.pathname === "/users/user-1/status"
      ) {
        expect(request.postDataJSON()).toEqual({ status: "inactive" });
        statusUpdates++;
        userRecord.status = "inactive";
        return route.fulfill({ status: 204 });
      }
      unexpectedRequests.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({
        status: 404,
        json: { message: "Unexpected synthetic API request" },
      });
    });

    await page.goto("/users");
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      fixtureDirections[language],
    );
    const initialFailure = page
      .getByRole("alert")
      .filter({ hasText: messages.requestLoadFailed });
    await expect(initialFailure).toBeVisible();
    await expect(initialFailure).toContainText(messages.networkError);
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.locator(".ant-empty")).toHaveCount(0);
    expect(listQueries).toHaveLength(1);
    await page.getByPlaceholder(messages.firstName, { exact: true }).focus();
    await expect(initialFailure).toBeVisible();
    const initialScreenshot = testInfo.outputPath("users-initial-error.png");
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: initialScreenshot,
    });
    await testInfo.attach("Users initial read failure", {
      contentType: "image/png",
      path: initialScreenshot,
    });

    await initialFailure
      .getByRole("button", { name: messages.retry, exact: true })
      .click();
    const row = page.getByRole("row", { name: /Ada Lovelace/ });
    await expect(row).toBeVisible();
    await expect(initialFailure).toHaveCount(0);
    await expect(
      row.getByRole("button", { name: messages.active, exact: true }),
    ).toBeVisible();
    expect(listQueries).toHaveLength(2);

    // A successful status mutation uses the page's real same-query reload path.
    await row
      .getByRole("button", { name: messages.active, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: messages.statusConfirm })
      .getByRole("button", { name: messages.yes, exact: true })
      .click();
    const refreshFailure = page
      .getByRole("alert")
      .filter({ hasText: messages.requestRefreshFailed });
    await expect(refreshFailure).toBeVisible();
    await expect(refreshFailure).toContainText(messages.networkError);
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("button", { name: messages.active, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".ant-empty")).toHaveCount(0);
    expect(statusUpdates).toBe(1);
    expect(listQueries).toHaveLength(3);
    expect(new Set(listQueries).size).toBe(1);
    const refreshScreenshot = testInfo.outputPath(
      "users-retained-rows-warning.png",
    );
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: refreshScreenshot,
    });
    await testInfo.attach("Users retained data after refresh failure", {
      contentType: "image/png",
      path: refreshScreenshot,
    });

    await refreshFailure
      .getByRole("button", { name: messages.retry, exact: true })
      .click();
    await expect(refreshFailure).toHaveCount(0);
    await expect(
      row.getByRole("button", { name: messages.inactive, exact: true }),
    ).toBeVisible();
    expect(listQueries).toHaveLength(4);
    expect(new Set(listQueries).size).toBe(1);
    expect(unexpectedRequests).toEqual([]);
  });
}
