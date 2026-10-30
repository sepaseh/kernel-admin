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

    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
  });
});
