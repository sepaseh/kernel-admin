import { mockApplicationSettings } from "./fixtures";
import { expect, test } from "./shared/admin-fixtures";

test.describe("production security headers", () => {
  test.beforeEach(async ({ page }) => {
    await mockApplicationSettings(page);
  });

  test("protects the built application response", async ({ page }) => {
    const response = await page.goto("/auth");

    expect(response).not.toBeNull();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    const headers = response!.headers();
    const contentSecurityPolicy = headers["content-security-policy"];

    expect(contentSecurityPolicy).toBeDefined();
    const directives = contentSecurityPolicy.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name.toLowerCase(), ...sources];
    });
    for (const [name, source] of [
      ["default-src", "'self'"],
      ["object-src", "'none'"],
      ["frame-ancestors", "'none'"],
      ["script-src", "'self'"],
    ]) {
      expect(directives.filter(([directive]) => directive === name)).toEqual([
        [name, source],
      ]);
    }
    expect(directives.filter(([name]) => name === "script-src-elem")).toEqual(
      [],
    );
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
  });
});
