import { catalogs } from "@/shared/i18n/catalogs";

import { applicationSettingsFixture, fixtureDirections } from "./fixtures";
import { expect, test } from "./shared/admin-fixtures";

for (const language of ["en", "fa"] as const) {
  const messages = catalogs[language];
  test(`Users report read failures and retain accepted rows (${language})`, async ({
    baseURL,
    page,
  }, testInfo) => {
    const apiOrigin = "https://api.example.com";
    const localOrigin = new URL(baseURL!).origin;
    const unexpectedRequests: string[] = [];
    const listQueries: string[] = [];
    let statusUpdates = 0;
    const userRecord = {
      first_name: "Ada",
      id: "user-1",
      is_system_admin: false,
      last_name: "Lovelace",
      mobile: "09121111111",
      roles: [],
      status: "active",
    };
    await page.addInitScript(() => {
      localStorage.setItem("theme", JSON.stringify("light"));
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
      if (request.method() === "GET" && url.pathname === "/users/user-1")
        return route.fulfill({ json: userRecord });
      if (request.method() === "PATCH" && url.pathname === "/users/user-1") {
        expect(request.postDataJSON()).toEqual({
          first_name: "Ada",
          last_name: "Lovelace",
          mobile: "09121111111",
          status: "inactive",
        });
        statusUpdates++;
        userRecord.status = "inactive";
        return route.fulfill({ json: userRecord });
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
    const initialFailure = page.getByText(messages.networkError, {
      exact: true,
    });
    await expect(initialFailure).toBeVisible();
    expect(listQueries).toHaveLength(1);
    await page.getByPlaceholder(messages.firstName, { exact: true }).focus();
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

    await page
      .getByPlaceholder(messages.firstName, { exact: true })
      .fill("Ada");
    const row = page.getByRole("row", { name: /Ada Lovelace/ });
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("img", { name: messages.active, exact: true }),
    ).toBeVisible();
    expect(listQueries).toHaveLength(2);
    expect(new URLSearchParams(listQueries[1]).get("first_name")).toBe("Ada");

    // A successful update uses the page's real same-query reload path.
    await row
      .getByRole("button", { name: messages.update, exact: true })
      .click();
    const drawer = page.getByRole("dialog", { name: messages.update });
    await expect(
      drawer.getByLabel(messages.mobile, { exact: true }),
    ).toHaveValue(userRecord.mobile);
    await expect(
      drawer.getByLabel(messages.firstName, { exact: true }),
    ).toHaveValue(userRecord.first_name);
    await drawer.getByLabel(messages.status, { exact: true }).click();
    await page
      .locator(".ant-select-dropdown:visible")
      .getByText(messages.inactive, { exact: true })
      .click();
    const failedReload = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/users" &&
        response.status() === 500,
    );
    await drawer
      .getByRole("button", { name: messages.submit, exact: true })
      .click();
    await failedReload;
    const refreshFailure = page
      .getByText(messages.networkError, { exact: true })
      .last();
    await expect(refreshFailure).toBeVisible();
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("img", { name: messages.active, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".ant-empty")).toHaveCount(0);
    expect(statusUpdates).toBe(1);
    expect(listQueries).toHaveLength(3);
    expect(listQueries[2]).toBe(listQueries[1]);
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

    await page.getByPlaceholder(messages.firstName, { exact: true }).fill("");
    await expect(
      row.getByRole("img", { name: messages.inactive, exact: true }),
    ).toBeVisible();
    expect(listQueries).toHaveLength(4);
    expect(listQueries[3]).toBe(listQueries[0]);
    expect(unexpectedRequests).toEqual([]);
  });
}
