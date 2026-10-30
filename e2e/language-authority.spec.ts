import { catalogs } from "@/shared/i18n/catalogs";
import type { LocaleCode } from "@/shared/i18n/locales";

import { applicationSettingsFixture } from "./fixtures";
import { expect, test } from "./shared/admin-fixtures";

test("failed initial settings retain bootstrap error language and retry before rendering routes", async ({
  page,
}) => {
  let available = false;
  await page.addInitScript(() => {
    localStorage.setItem("language", '"en"');
  });
  await page.route("https://api.example.com/settings", (route) =>
    available
      ? route.fulfill({ json: applicationSettingsFixture("en") })
      : route.fulfill({
          status: 503,
          json: { message: "Synthetic settings unavailable" },
        }),
  );
  await page.goto("/auth");
  await expect(page.getByText("Synthetic settings unavailable")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("language"))).toBe(
    '"en"',
  );
  available = true;
  await page
    .getByRole("button", { name: catalogs.fa.retry, exact: true })
    .click();
  await expect(page.getByText("Synthetic settings unavailable")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(
    page.getByRole("heading", { name: catalogs.en.login, exact: true }),
  ).toBeVisible();
});

test("returning to an anonymous page reloads the global API language", async ({
  page,
}) => {
  let language: LocaleCode = "en";
  await page.route("https://api.example.com/settings", (route) =>
    route.fulfill({ json: applicationSettingsFixture(language) }),
  );
  await page.goto("/auth");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  language = "fa";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(
    page.getByRole("heading", { name: catalogs.fa.login }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("language")),
  ).toBeNull();
});

test("same-code API direction and calendar changes update HTML, Ant Design and the displayed calendar", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-01T12:00:00Z"));
  let direction: "ltr" | "rtl" = "ltr";
  let calendar: "gregorian" | "jalali" = "gregorian";
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
  await expect(year).toContainText("2026");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(year).not.toHaveClass(/ant-select-rtl/);
  await expect(nextArrow).toHaveClass(/lucide-chevron-right/);

  direction = "rtl";
  calendar = "jalali";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(year).toContainText("1405");
  await expect(year).toHaveClass(/ant-select-rtl/);
  await expect(
    page.locator(".ant-select").filter({
      has: page.getByRole("combobox", { name: catalogs.en.calendarMonth }),
    }),
  ).toContainText("Shahrivar");
  await expect(nextArrow).toHaveClass(/lucide-chevron-left/);

  direction = "ltr";
  calendar = "gregorian";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(year).toContainText("2026");
  await expect(year).not.toHaveClass(/ant-select-rtl/);
});

test("malformed API metadata shows an error and keeps the last verified language metadata", async ({
  page,
}) => {
  let direction = "ltr";
  await page.route("https://api.example.com/settings", (route) => {
    const settings = applicationSettingsFixture("en");
    return route.fulfill({
      json: { ...settings, language: { ...settings.language, direction } },
    });
  });
  await page.goto("/auth");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  direction = "auto";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(catalogs.en.unexpectedError)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  direction = "rtl";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText(catalogs.en.unexpectedError)).toHaveCount(0);
});

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
        else expect(payload).not.toHaveProperty("language_code");
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
      await expect(languageControl).toHaveCount(0);
    }
    await page
      .getByRole("button", { name: catalogs.en.submit, exact: true })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: catalogs.en.settingsChangeConfirm,
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    // Firefox can report the scaled button stable between opening-motion phases.
    // Wait for the dialog's real transition before the same pointer confirmation.
    await expect(confirmation).not.toHaveClass(/\bant-zoom-(?:appear|enter)\b/);
    await confirmation
      .getByRole("button", { name: catalogs.en.yes, exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    expect(writes).toHaveLength(1);
    expect(
      await page.evaluate(() => localStorage.getItem("language")),
    ).toBeNull();
  });
}
