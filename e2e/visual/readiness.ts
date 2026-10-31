import { expect, type Page } from "@playwright/test";

export const waitForVisualReady = async (
  page: Page,
  { language, theme }: { language: "en" | "fa"; theme: "light" | "dark" },
) => {
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(page.locator("html")).toHaveAttribute(
    "dir",
    language === "fa" ? "rtl" : "ltr",
  );
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    theme === "dark" ? "rgb(20, 20, 20)" : "rgb(255, 255, 255)",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const fonts = await page.evaluate(() =>
    [...document.fonts].map(({ family, status }) => ({ family, status })),
  );
  expect(
    fonts.length,
    "Self-hosted font faces must be registered",
  ).toBeGreaterThan(0);
  expect(fonts.filter(({ status }) => status === "error")).toEqual([]);
  expect(fonts.some(({ status }) => status === "loaded")).toBe(true);
};
