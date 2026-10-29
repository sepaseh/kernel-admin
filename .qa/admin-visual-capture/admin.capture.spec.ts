import { capturePending } from "./capture-pending";
import { expect, setupAdminFixture, test } from "../../coverage/qa-transport/product/e2e/shared/admin-fixtures";
import { waitForVisualReady } from "../../coverage/qa-transport/product/e2e/visual/readiness";

const baseURL = "http://127.0.0.1:4185";

for (const scenario of [
  { name: "admin-login-en-light", language: "en", theme: "light", width: 1280 },
  { name: "admin-login-fa-dark", language: "fa", theme: "dark", width: 360 },
] as const) {
  test(scenario.name, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    const fixture = await setupAdminFixture(page, { baseURL, ...scenario });
    await page.goto(`${baseURL}/auth`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByLabel(fixture.messages.password, { exact: true }),
    ).toBeVisible();
    await waitForVisualReady(page, scenario);
    await capturePending(page, `${scenario.name}.png`, {
      fullPage: true,
    });
    expect(fixture.unexpectedRequests).toEqual([]);
  });
}

test("admin-role-drawer-en-dark", async ({ page }) => {
  const fixture = await setupAdminFixture(page, {
    baseURL,
    language: "en",
    theme: "dark",
  });
  await page.goto(`${baseURL}/roles`);
  await page
    .getByRole("button", { name: fixture.messages.create, exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: fixture.messages.create }),
  ).toBeVisible();
  await expect(
    page.getByLabel(fixture.messages.name, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: `${fixture.messages.update} ${fixture.messages.users}`,
      exact: true,
    }),
  ).toBeVisible();
  await waitForVisualReady(page, { language: "en", theme: "dark" });
  await capturePending(page, "admin-role-drawer-en-dark.png");
  expect(fixture.unexpectedRequests).toEqual([]);
});

test("admin-users-fa-light", async ({ page }) => {
  const fixture = await setupAdminFixture(page, {
    baseURL,
    language: "fa",
    legacySecondUser: true,
    theme: "light",
  });
  await page.goto(`${baseURL}/users`);
  await expect(page.getByText("Ada Lovelace", { exact: true })).toBeVisible();
  await expect(page.getByText("Grace Hopper", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("row", { name: /Grace Hopper/ })
      .getByRole("img", { name: fixture.messages.inactive, exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await waitForVisualReady(page, { language: "fa", theme: "light" });
  await capturePending(page, "admin-users-fa-light.png");
  expect(fixture.unexpectedRequests).toEqual([]);
});

for (const scenario of [
  {
    name: "admin-forgot-password-en-light",
    route: "auth/forgot-password",
    label: "mobile",
  },
  {
    name: "admin-register-en-light",
    route: "auth/register",
    label: "firstName",
  },
] as const) {
  test(scenario.name, async ({ page }) => {
    const fixture = await setupAdminFixture(page, {
      baseURL,
      language: "en",
      theme: "light",
    });
    await page.goto(`${baseURL}/${scenario.route}`);
    await expect(page.locator("form")).toBeVisible();
    await expect(
      page.getByLabel(fixture.messages[scenario.label], { exact: true }),
    ).toBeVisible();
    await waitForVisualReady(page, { language: "en", theme: "light" });
    await capturePending(page, `${scenario.name}.png`, {
      fullPage: true,
    });
    expect(fixture.unexpectedRequests).toEqual([]);
  });
}
