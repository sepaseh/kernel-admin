import { catalogs } from "@/shared/i18n/catalogs";
import { localeCodes } from "@/shared/i18n/locales";

import {
  fixtureDirections,
  mockApplicationSettings,
  syntheticCredential,
} from "./fixtures";
import { expect, test } from "./shared/admin-fixtures";

test.describe("localized critical journeys", () => {
  for (const language of localeCodes) {
    const messages = catalogs[language];
    const direction = fixtureDirections[language];
    test(`logs in using ${language.toUpperCase()}/${direction.toUpperCase()}`, async ({
      page,
    }, testInfo) => {
      const legacyLanguage = language === "fa" ? "en" : "fa";
      await page.addInitScript((legacyLanguage) => {
        localStorage.setItem("language", JSON.stringify(legacyLanguage));
        localStorage.setItem("theme", "light");
      }, legacyLanguage);
      await mockApplicationSettings(page, language);
      await page.route("https://api.example.com/auth/login", async (route) => {
        expect(route.request().postDataJSON()).toEqual({
          identifier: "ada",
          password: syntheticCredential,
        });
        await route.fulfill({
          contentType: "application/json",
          json: { access_token: "access-token" },
        });
      });
      await page.route("https://api.example.com/account/me", async (route) => {
        await route.fulfill({
          contentType: "application/json",
          json: {
            email: "ada@example.com",
            first_name: "Ada",
            id: "user-1",
            is_system_admin: false,
            last_name: "Lovelace",
            mobile: "09120000000",
            permissions: [],
            status: "active",
            username: "ada",
          },
        });
      });
      await page.goto("/auth");

      await expect(page.locator("html")).toHaveAttribute("dir", direction);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      expect(await page.evaluate(() => localStorage.getItem("language"))).toBe(
        JSON.stringify(legacyLanguage),
      );
      await page.evaluate((legacyLanguage) => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "language",
            newValue: JSON.stringify(legacyLanguage),
          }),
        );
      }, legacyLanguage);
      await expect(
        page.getByRole("heading", {
          exact: true,
          name: messages.login,
        }),
      ).toBeVisible();
      await expect(
        page.getByLabel(messages.identifier, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel(messages.password, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          exact: true,
          name: messages.login,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      if (language === "ar") {
        const image = await page.screenshot({
          fullPage: true,
          path: testInfo.outputPath("arabic-login-rtl.png"),
        });
        await testInfo.attach("Arabic login RTL", {
          body: image,
          contentType: "image/png",
        });
      }
      await page.getByLabel(messages.identifier, { exact: true }).fill("ada");
      await page
        .getByLabel(messages.password, { exact: true })
        .fill(syntheticCredential);
      await page
        .getByRole("button", {
          exact: true,
          name: messages.login,
        })
        .click();

      await expect(page).toHaveURL(/\/$/);
      await expect(
        page.getByRole("link", {
          exact: true,
          name: messages.logo,
        }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", direction);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(
        page.getByRole("navigation", { name: messages.breadcrumb }),
      ).toContainText(messages.dashboard);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      if (language === "ar") {
        const image = await page.screenshot({
          fullPage: true,
          path: testInfo.outputPath("arabic-shell-rtl.png"),
        });
        await testInfo.attach("Arabic shell RTL", {
          body: image,
          contentType: "image/png",
        });
      }
    });
  }
});
