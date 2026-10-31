import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

import { profileNameMaxLength } from "@/shared/contracts";
import { contrastRatio } from "@/shared/lib/color-contrast";

import { expect, test } from "./shared/admin-fixtures";
import { setupAdminFixture } from "./shared/admin-fixtures";

const expectNoAxeViolations = async (page: Page, testInfo: TestInfo) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const { violations, incomplete } = await new AxeBuilder({ page }).analyze();
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
        test(`${form.title} form includes contrast`, async ({
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
            ).toHaveAttribute("maxlength", String(profileNameMaxLength));
          await expectNoAxeViolations(page, testInfo);
          const { violations, incomplete } = await new AxeBuilder({ page })
            .include("form")
            .withRules(["color-contrast"])
            .analyze();
          await testInfo.attach("auth-form-color-contrast", {
            body: JSON.stringify({ violations, incomplete }, null, 2),
            contentType: "application/json",
          });
          expect(violations).toEqual([]);
          expect(incomplete).toEqual([]);
          expect(unexpectedRequests).toEqual([]);
        });
      }

      test("invalid login focuses and describes its first invalid field with contrast", async ({
        page,
        baseURL,
      }, testInfo) => {
        const { messages, unexpectedRequests } = await setupAdminFixture(page, {
          baseURL: baseURL!,
          language,
          theme,
        });
        await page.goto("/auth");
        const identifier = page.getByLabel(messages.identifier, {
          exact: true,
        });
        await identifier.focus();
        await page.keyboard.press("Tab");
        await expect(
          page.getByLabel(messages.password, { exact: true }),
        ).toBeFocused();
        await page
          .getByRole("button", { name: messages.login, exact: true })
          .click();
        await expect(identifier).toBeFocused();
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

      test("user and role tables support keyboard scrolling and empty roles include contrast", async ({
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
        const usersRegion = page.getByRole("region", {
          name: messages.users,
          exact: true,
        });
        await expect(usersRegion).toHaveAttribute("tabindex", "0");
        const overflow = await usersRegion.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        );
        if (testInfo.project.name === "mobile-chromium")
          expect(overflow).toBe(true);
        if (overflow) {
          await usersRegion.focus();
          await expect(usersRegion).toBeFocused();
          const before = await usersRegion.evaluate(
            (element) => element.scrollLeft,
          );
          await page.keyboard.press(
            language === "fa" ? "ArrowLeft" : "ArrowRight",
          );
          await expect
            .poll(() => usersRegion.evaluate((element) => element.scrollLeft))
            .not.toBe(before);
        }
        const status = page
          .getByRole("row", { name: /Ada Lovelace/ })
          .getByRole("img", { name: messages.active, exact: true });
        const statusColors = await status.evaluate((element) => {
          let parent: Element | null = element;
          while (
            parent &&
            ["rgba(0, 0, 0, 0)", "transparent"].includes(
              getComputedStyle(parent).backgroundColor,
            )
          )
            parent = parent.parentElement;
          return {
            foreground: getComputedStyle(element).color,
            background: getComputedStyle(parent!).backgroundColor,
          };
        });
        expect(
          contrastRatio(statusColors.foreground, statusColors.background),
        ).toBeGreaterThanOrEqual(3);
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
        const rolesRegion = page.getByRole("region", {
          name: messages.roles,
          exact: true,
        });
        await expect(rolesRegion).toHaveAttribute("tabindex", "0");
        const rolesOverflow = await rolesRegion.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        );
        if (testInfo.project.name === "mobile-chromium")
          expect(rolesOverflow).toBe(true);
        if (rolesOverflow) {
          await rolesRegion.focus();
          await expect(rolesRegion).toBeFocused();
          const before = await rolesRegion.evaluate(
            (element) => element.scrollLeft,
          );
          await page.keyboard.press(
            language === "fa" ? "ArrowLeft" : "ArrowRight",
          );
          await expect
            .poll(() => rolesRegion.evaluate((element) => element.scrollLeft))
            .not.toBe(before);
        }
        await expectNoAxeViolations(page, testInfo);
        expect(unexpectedRequests).toEqual([]);
      });

      test("role drawer loops keyboard focus, closes with Escape and restores its trigger", async ({
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
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", {
          name: messages.create,
          exact: true,
        });
        const first = dialog.getByLabel(messages.name, { exact: true });
        const last = dialog.getByRole("button", {
          name: messages.submit,
          exact: true,
        });
        await expect(first).toBeFocused();
        const checkbox = dialog.getByRole("checkbox", {
          name: messages.users,
          exact: true,
        });
        await checkbox.check();
        const colors = await checkbox.evaluate((input) => {
          const inner = input.parentElement!;
          return {
            fill: getComputedStyle(inner).backgroundColor,
            check: getComputedStyle(inner, "::after").borderBottomColor,
            surface: getComputedStyle(input.closest('[role="dialog"]')!)
              .backgroundColor,
          };
        });
        expect(contrastRatio(colors.check, colors.fill)).toBeGreaterThanOrEqual(
          3,
        );
        expect(
          contrastRatio(colors.fill, colors.surface),
        ).toBeGreaterThanOrEqual(3);
        await first.focus();
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await page.keyboard.press("Shift+Tab");
        await expect(last).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(first).toBeFocused();
        await expectNoAxeViolations(page, testInfo);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(unexpectedRequests).toEqual([]);
      });

      test("destructive confirmation traps focus without submitting and restores its trigger", async ({
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
        const first = dialog.getByRole("button", {
          name: messages.no,
          exact: true,
        });
        const last = dialog.getByRole("button", {
          name: messages.yes,
          exact: true,
        });
        // Wait for AntD's deferred default-button autofocus before tabbing;
        // manually focusing early can race the primitive's own focus effect.
        await expect(last).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(first).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(last).toBeFocused();
        await expectNoAxeViolations(page, testInfo);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(requests.some((request) => request.startsWith("DELETE "))).toBe(
          false,
        );
        expect(unexpectedRequests).toEqual([]);
      });
    });
  }
}
