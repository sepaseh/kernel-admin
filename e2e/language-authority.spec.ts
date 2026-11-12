import { catalogs } from "@/shared/i18n/catalogs";
import type { LocaleCode } from "@/shared/i18n/locales";

import { applicationSettingsFixture } from "./fixtures";
import { expect, test } from "./shared/admin-fixtures";

test("failed initial settings retain bootstrap error language before rendering routes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("language", '"en"');
  });
  await page.route("https://api.example.com/settings", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Synthetic settings unavailable" },
    }),
  );
  await page.goto("/auth");
  await expect(page.getByText(catalogs.en.settingsLoadFailed)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).direction),
  ).toBe("ltr");
  await expect(page.getByRole("heading")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("language"))).toBe(
    '"en"',
  );
});

test("each anonymous page load uses its initial API language", async ({
  page,
}) => {
  let language: LocaleCode = "en";
  await page.route("https://api.example.com/settings", (route) =>
    route.fulfill({ json: applicationSettingsFixture(language) }),
  );
  await page.goto("/auth");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: catalogs.en.login }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("language")),
  ).toBeNull();
  language = "fa";
  await page.goto("/auth");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(
    page.getByRole("heading", { name: catalogs.fa.login }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("language")),
  ).toBeNull();
});

for (const [
  direction,
  calendar,
  expectedYear,
  expectedMonth,
  expectedArrow,
] of [
  ["ltr", "gregory", "2026", "September", "lucide-chevron-right"],
  ["rtl", "jalali", "1405", "Shahrivar", "lucide-chevron-left"],
] as const) {
  test(`initial English API metadata applies ${direction}/${calendar} to HTML, Ant Design and the calendar`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-09-01T12:00:00Z"));
    await page.route("https://api.example.com/settings", (route) => {
      const settings = applicationSettingsFixture("en");
      return route.fulfill({
        json: {
          ...settings,
          language: { ...settings.language, calendar, direction },
        },
      });
    });
    await page.route("https://api.example.com/account/me", (route) =>
      route.fulfill({
        json: {
          first_name: "Calendar",
          id: "calendar-user",
          is_system_admin: true,
          last_name: "Reader",
          permissions: [],
          status: "active",
        },
      }),
    );
    await page.route("https://api.example.com/calendar", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto("/calendar");
    const year = page.locator(".ant-select").filter({
      has: page.getByRole("combobox", { name: catalogs.en.calendarYear }),
    });
    const nextArrow = page
      .getByRole("button", { name: catalogs.en.nextMonth })
      .locator("svg");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", direction);
    await expect(year).toContainText(expectedYear);
    if (direction === "rtl") await expect(year).toHaveClass(/ant-select-rtl/);
    else await expect(year).not.toHaveClass(/ant-select-rtl/);
    await expect(
      page.locator(".ant-select").filter({
        has: page.getByRole("combobox", { name: catalogs.en.calendarMonth }),
      }),
    ).toContainText(expectedMonth);
    await expect(nextArrow).toHaveClass(new RegExp(expectedArrow));
    expect(
      await page.evaluate(() => localStorage.getItem("language")),
    ).toBeNull();
  });
}

for (const isSystemAdmin of [false, true]) {
  test(`${isSystemAdmin ? "super-admin" : "settings editor"} saves settings with the correct language authority`, async ({
    page,
  }) => {
    let language: LocaleCode = "en";
    const writes: Record<string, unknown>[] = [];
    await page.route("https://api.example.com/settings", async (route) => {
      if (route.request().method() === "PUT") {
        const payload = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        writes.push(payload);
        if (isSystemAdmin) expect(payload.language_code).toBe("fa");
        expect(payload).toHaveProperty("dark_theme");
        expect(payload).toHaveProperty("light_theme");
        // A normal appearance save also consumes the backend's current language.
        language = "fa";
      }
      await route.fulfill({ json: applicationSettingsFixture(language) });
    });
    await page.route("https://api.example.com/languages", (route) =>
      route.fulfill({
        json: [
          applicationSettingsFixture("en").language,
          applicationSettingsFixture("fa").language,
        ],
      }),
    );
    await page.route("https://api.example.com/account/me", (route) =>
      route.fulfill({
        json: {
          first_name: "Settings",
          id: "settings-user",
          is_system_admin: isSystemAdmin,
          last_name: "Editor",
          mobile: "09120000000",
          permissions: ["settings.update"],
          status: "active",
        },
      }),
    );
    await page.goto("/settings");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("button", { name: catalogs.en.submit, exact: true }),
    ).toBeEnabled();
    const languageControl = page.getByRole("combobox", {
      name: catalogs.en.language,
    });
    if (isSystemAdmin) {
      await languageControl.click();
      await page
        .locator(".ant-select-item-option")
        .filter({ hasText: "fa" })
        .click();
    } else {
      await expect(languageControl).toBeDisabled();
    }
    await page
      .getByRole("button", { name: catalogs.en.submit, exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    expect(writes).toHaveLength(1);
    expect(
      await page.evaluate(() => localStorage.getItem("language")),
    ).toBeNull();
  });
}
