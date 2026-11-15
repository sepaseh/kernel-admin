import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

import { expect, test } from "./shared/admin-fixtures";
import { setupAdminFixture } from "./shared/admin-fixtures";

const expectNoAxeViolations = async (page: Page, testInfo: TestInfo) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const { violations, incomplete } = await new AxeBuilder({ page })
    .disableRules(["color-contrast", "scrollable-region-focusable"])
    .analyze();
  await testInfo.attach(`axe-${testInfo.attachments.length}`, {
    body: JSON.stringify({ violations, incomplete }, null, 2),
    contentType: "application/json",
  });
  expect(violations).toEqual([]);
};

test.use({ reducedMotion: "reduce" });

for (const language of ["en", "fa"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`accessibility ${language} ${theme}`, () => {
      for (const form of [
        { path: "/auth", title: "login" },
        { path: "/auth/register", title: "register" },
        { path: "/auth/forgot-password", title: "forgotPassword" },
      ] as const) {
        test(`${form.title} form has accessible names and structure`, async ({
          page,
          baseURL,
        }, testInfo) => {
          const { messages, unexpectedRequests } = await setupAdminFixture(
            page,
            {
              baseURL: baseURL!,
              language,
              theme,
            },
          );
          await page.goto(form.path);
          await expect(
            page.getByRole("heading", {
              level: 1,
              name: messages[form.title],
              exact: true,
            }),
          ).toBeVisible();
          if (form.title === "register")
            await expect(
              page.getByLabel(messages.firstName, { exact: true }),
            ).toBeVisible();
          await expectNoAxeViolations(page, testInfo);
          expect(unexpectedRequests).toEqual([]);
        });
      }

      test("invalid login describes its first invalid field", async ({
        page,
        baseURL,
      }, testInfo) => {
        const { messages, unexpectedRequests } = await setupAdminFixture(page, {
          baseURL: baseURL!,
          language,
          theme,
        });
        await page.goto("/auth");
        const identifier = page.getByLabel(messages.mobile, {
          exact: true,
        });
        await page
          .getByRole("button", { name: messages.login, exact: true })
          .click();
        await expect(identifier).toHaveAttribute("aria-invalid", "true");
        await expect(identifier).toHaveAttribute("aria-describedby", /.+/);
        const errorId = (await identifier.getAttribute(
          "aria-describedby",
        ))!.split(" ")[0];
        await expect(page.locator(`[id="${errorId}"]`)).toBeVisible();
        await expect(
          page.locator(`[id="${errorId}"] .ant-form-item-explain-error`),
        ).toHaveCSS("opacity", "1");
        await testInfo.attach("invalid-field-styles", {
          body: JSON.stringify(
            await page.locator(`[id="${errorId}"]`).evaluate((root) =>
              [...root.querySelectorAll("*")].map((element) => ({
                color: getComputedStyle(element).color,
                opacity: getComputedStyle(element).opacity,
                parentOpacity: getComputedStyle(element.parentElement!).opacity,
                html: element.outerHTML,
              })),
            ),
          ),
          contentType: "application/json",
        });
        await expectNoAxeViolations(page, testInfo);
        expect(unexpectedRequests).toEqual([]);
      });

      test("user and role tables retain accessible content and actions", async ({
        page,
        baseURL,
      }, testInfo) => {
        const { messages, unexpectedRequests } = await setupAdminFixture(page, {
          baseURL: baseURL!,
          language,
          theme,
        });
        await page.goto("/users");
        await expect(
          page.getByRole("row", { name: /Ada Lovelace/ }),
        ).toBeVisible();
        await expect(
          page
            .getByRole("row", { name: /Ada Lovelace/ })
            .getByRole("img", { name: messages.active, exact: true }),
        ).toBeVisible();
        await expectNoAxeViolations(page, testInfo);
        await page.goto("/roles");
        await expect(
          page.getByRole("button", { name: messages.create, exact: true }),
        ).toBeVisible();
        await expectNoAxeViolations(page, testInfo);
        const roleName =
          "Support operators with user administration permissions";
        await page.route("https://api.example.com/roles", async (route) => {
          await route.fulfill({
            json: [
              { id: "role-1", name: roleName, permissions: ["users.read"] },
            ],
          });
        });
        await page.goto("/roles");
        await expect(
          page.getByRole("cell", { name: roleName, exact: true }),
        ).toBeVisible();
        await expectNoAxeViolations(page, testInfo);
        expect(unexpectedRequests).toEqual([]);
      });

      test("role drawer opens from the keyboard and closes with Escape", async ({
        page,
        baseURL,
      }, testInfo) => {
        const { messages, unexpectedRequests } = await setupAdminFixture(page, {
          baseURL: baseURL!,
          language,
          theme,
        });
        await page.goto("/roles");
        const trigger = page.getByRole("button", {
          name: messages.create,
          exact: true,
        });
        await expect(trigger).toBeEnabled();
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", {
          name: messages.create,
          exact: true,
        });
        await expect(
          dialog.getByLabel(messages.name, { exact: true }),
        ).toBeVisible();
        await expect(
          dialog.getByRole("button", {
            name: messages.submit,
            exact: true,
          }),
        ).toBeVisible();
        const checkbox = dialog.getByRole("checkbox", {
          name: messages.users,
          exact: true,
        });
        await checkbox.check();
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await expectNoAxeViolations(page, testInfo);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        expect(unexpectedRequests).toEqual([]);
      });

      test("destructive confirmation closes with Escape without submitting", async ({
        page,
        baseURL,
      }, testInfo) => {
        const { messages, requests, unexpectedRequests } =
          await setupAdminFixture(page, {
            baseURL: baseURL!,
            language,
            theme,
            permissions: ["users.read", "users.delete"],
          });
        await page.goto("/users");
        const trigger = page
          .getByRole("row", { name: /Ada Lovelace/ })
          .getByRole("button", { name: messages.delete, exact: true });
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", {
          name: messages.deleteUserConfirm,
          exact: true,
        });
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByRole("button", {
            name: messages.no,
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          dialog.getByRole("button", {
            name: messages.yes,
            exact: true,
          }),
        ).toBeVisible();
        await expectNoAxeViolations(page, testInfo);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        expect(requests.some((request) => request.startsWith("DELETE "))).toBe(
          false,
        );
        expect(unexpectedRequests).toEqual([]);
      });
    });
  }
}
