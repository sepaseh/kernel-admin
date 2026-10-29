import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "../../coverage/qa-transport/product/node_modules/@playwright/test";
import { expect } from "../../coverage/qa-transport/product/e2e/shared/admin-fixtures";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const names = new Set([
  "admin-login-en-light.png",
  "admin-login-fa-dark.png",
  "admin-role-drawer-en-dark.png",
  "admin-users-fa-light.png",
  "admin-forgot-password-en-light.png",
  "admin-register-en-light.png",
]);

export const capturePending = async (
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
) => {
  if (process.env.CI !== "true" || !names.has(name))
    throw new Error(
      "Only the six explicitly named pending CI captures are allowed.",
    );
  let previous: Buffer | undefined;
  let stable: Buffer | undefined;
  await expect
    .poll(
      async () => {
        const current = await page.screenshot({
          ...options,
          animations: "disabled",
          caret: "hide",
          scale: "css",
          type: "png",
        });
        const matches = previous?.equals(current) ?? false;
        previous = current;
        if (matches) stable = current;
        return matches;
      },
      { message: `Pending capture ${name} must settle before writing pixels` },
    )
    .toBe(true);
  if (!stable) throw new Error("No stable pending screenshot was produced.");
  await writeFile(
    path.join(repository, "coverage/qa-visual/pending", name),
    stable,
    { flag: "wx" },
  );
};
