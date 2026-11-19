import AxeBuilder from "@axe-core/playwright";
import { expect, type Request, test } from "@playwright/test";

const apiHealthUrl = process.env.STAGING_API_HEALTH_URL;

if (!apiHealthUrl) {
  throw new Error("STAGING_API_HEALTH_URL is required");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("language", "en");
    localStorage.setItem("theme", "light");
  });
});

test("loads the deployed application and same-origin assets", async ({
  page,
}) => {
  const applicationOrigin = new URL(test.info().project.use.baseURL as string)
    .origin;
  const isApplicationAsset = (request: Request) =>
    ["font", "script", "stylesheet"].includes(request.resourceType()) &&
    new URL(request.url()).origin === applicationOrigin;
  const failedAssets: string[] = [];
  let assetCount = 0;

  page.on("response", (response) => {
    if (!isApplicationAsset(response.request())) return;
    assetCount += 1;
    if (!response.ok()) {
      failedAssets.push(response.url());
    }
  });
  page.on("requestfailed", (request) => {
    if (isApplicationAsset(request)) {
      failedAssets.push(request.url());
    }
  });

  const response = await page.goto("auth");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("kernel");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(assetCount).toBeGreaterThan(0);
  expect(failedAssets).toEqual([]);
});

test("supports direct client-side route navigation", async ({ page }) => {
  const response = await page.goto("auth/register");

  expect(response?.ok()).toBe(true);
  await expect(page.locator("form")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/register\/?$/);
});

test("public journeys have no detectable accessibility violations", async ({
  page,
}) => {
  for (const path of ["auth", "auth/forgot-password", "auth/register"]) {
    await page.goto(path);
    await expect(page.locator("main, form").first()).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.map(
      ({ help, id, impact, nodes }) => ({
        help,
        id,
        impact,
        targets: nodes.map(({ target }) => target),
      }),
    );

    expect(violations).toEqual([]);
  }
});

test("serves the production security policy", async ({ page }) => {
  const response = await page.goto("auth");

  expect(response).not.toBeNull();
  const headers = response!.headers();
  const contentSecurityPolicy = headers["content-security-policy"];

  expect(contentSecurityPolicy).toContain("default-src 'self'");
  expect(contentSecurityPolicy).toContain("object-src 'none'");
  expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

test("reaches the staging API health endpoint", async ({ request }) => {
  const response = await request.get(apiHealthUrl, {
    failOnStatusCode: false,
  });

  expect(response.ok()).toBe(true);
});
